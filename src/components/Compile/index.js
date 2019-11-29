const Profiler = require("./profiler");
const OS = require("os");
const path = require("path");
const CompileError = require("./compileerror");
const expect = require("@truffle/expect");
const find_contracts = require("@truffle/contract-sources");
const Config = require("../Config");

// Most basic of the compile commands. Takes a hash of sources, where
// the keys are file or module paths and the values are the bodies of
// the contracts. Does not evaulate dependencies that aren't already given.
//
// Default options:
// {
//   strict: false,
//   quiet: false,
//   logger: console
// }

const preReleaseCompilerWarning = require('./messages').preReleaseCompilerWarning;

const compile = function(sources, options, callback) {
  if (typeof options == "function") {
    callback = options;
    options = {};
  }

  if (options.logger == null) {
    options.logger = console;
  }

  expect.options(options, [
    "contracts_directory",
    "solc"
  ]);

  // Load solc module only when compilation is actually required.
  const {getWrapper} = require("../Solc");

  const solc = getWrapper(options);
  // Clean up after solc.
  const listeners = process.listeners("uncaughtException");
  let solc_listener = listeners[listeners.length - 1];

  if (solc_listener) {
    process.removeListener("uncaughtException", solc_listener);
  }


  // Ensure sources have operating system independent paths
  // i.e., convert backslashes to forward slashes; things like C: are left intact.
  let operatingSystemIndependentSources = {};
  let originalPathMappings = {};

  Object.keys(sources).forEach(function(source) {
    // Turn all backslashes into forward slashes
    let replacement = source.replace(/\\/g, "/");

    // Turn G:/.../ into /G/.../ for Windows
    if (replacement.length >= 2 && replacement[1] === ":") {
      replacement = "/" + replacement;
      replacement = replacement.replace(":", "");
    }

    // Save the result
    operatingSystemIndependentSources[replacement] = sources[source];

    // Map the replacement back to the original source path.
    originalPathMappings[replacement] = source;
  });

  let solcStandardInput = {
    language: "Solidity",
    sources: {},
    settings: {
      evmVersion: options.solc.evmVersion,
      optimizer: options.solc.optimizer,
      outputSelection: {
        "*": {
          "": [
            "legacyAST",
            "ast"
          ],
          "*": [
            "abi",
            "evm.bytecode.object",
            "evm.bytecode.sourceMap",
            "evm.deployedBytecode.object",
            "evm.deployedBytecode.sourceMap"
          ]
        },
      }
    }
  };

  // Nothing to compile? Bail.
  if (Object.keys(sources).length === 0) {
    return callback(null, [], []);
  }

  Object.keys(operatingSystemIndependentSources).forEach(function(file_path) {
    solcStandardInput.sources[file_path] = {
      content: operatingSystemIndependentSources[file_path]
    }
  });

  let result = solc[solc.compileStandard ? 'compileStandard' : 'compile'](JSON.stringify(solcStandardInput));

  let standardOutput = JSON.parse(result);

  let errors = standardOutput.errors || [];
  let warnings = [];

  if (options.strict !== true) {
    warnings = errors.filter(function(error) {
      return error.severity === "warning" && error.message !== preReleaseCompilerWarning;
    });

    errors = errors.filter(function(error) {
      return error.severity !== "warning";
    });

    if (options.quiet !== true && warnings.length > 0) {
      options.logger.log(OS.EOL + "Compilation warnings encountered:" + OS.EOL);
      options.logger.log(warnings.map(function (warning) {
        return warning.formattedMessage;
      }).join());
    }
  }

  if (errors.length > 0) {
    options.logger.log("");
    return callback(new CompileError(standardOutput.errors.map(function(error) {
      return error.formattedMessage;
    }).join()));
  }

  let contracts = standardOutput.contracts;

  let files = [];
  Object.keys(standardOutput.sources).forEach(function(filename) {
    let source = standardOutput.sources[filename];
    files[source.id] = originalPathMappings[filename];
  });

  let returnVal = {};

  // This block has comments in it as it's being prepared for solc > 0.4.10
  Object.keys(contracts).forEach(function(source_path) {
    let files_contracts = contracts[source_path];

    Object.keys(files_contracts).forEach(function(contract_name) {
      let contract = files_contracts[contract_name];

      let contract_definition = {
        contract_name: contract_name,
        sourcePath: originalPathMappings[source_path], // Save original source path, not modified ones
        source: operatingSystemIndependentSources[source_path],
        sourceMap: contract.evm.bytecode.sourceMap,
        deployedSourceMap: contract.evm.deployedBytecode.sourceMap,
        legacyAST: standardOutput.sources[source_path].legacyAST,
        ast: standardOutput.sources[source_path].ast,
        abi: contract.abi,
        bytecode: "0x" + contract.evm.bytecode.object,
        deployedBytecode: "0x" + contract.evm.deployedBytecode.object,
        unlinked_binary: "0x" + contract.evm.bytecode.object, // deprecated
        compiler: {
          "name": "solc",
          "version": solc.version()
        }
      };

      // Reorder ABI so functions are listed in the order they appear
      // in the source file. Solidity tests need to execute in their expected sequence.
      contract_definition.abi = orderABI(contract_definition);

      // Go through the link references and replace them with older-style
      // identifiers. We'll do this until we're ready to making a breaking
      // change to this code.
      Object.keys(contract.evm.bytecode.linkReferences).forEach(function(file_name) {
        let fileLinks = contract.evm.bytecode.linkReferences[file_name];

        Object.keys(fileLinks).forEach(function(library_name) {
          let linkReferences = fileLinks[library_name] || [];

          contract_definition.bytecode = replaceLinkReferences(contract_definition.bytecode, linkReferences, library_name);
          contract_definition.unlinked_binary = replaceLinkReferences(contract_definition.unlinked_binary, linkReferences, library_name);
        });
      });

      // Now for the deployed bytecode
      Object.keys(contract.evm.deployedBytecode.linkReferences).forEach(function(file_name) {
        let fileLinks = contract.evm.deployedBytecode.linkReferences[file_name];

        Object.keys(fileLinks).forEach(function(library_name) {
          let linkReferences = fileLinks[library_name] || [];

          contract_definition.deployedBytecode = replaceLinkReferences(contract_definition.deployedBytecode, linkReferences, library_name);
        });
      });

      returnVal[contract_name] = contract_definition;
    });
  });

  callback(null, returnVal, files);
};

function replaceLinkReferences(bytecode, linkReferences, libraryName) {
  let linkId = "__" + libraryName;

  while (linkId.length < 40) {
    linkId += "_";
  }

  linkReferences.forEach(function(ref) {
    // ref.start is a byte offset. Convert it to character offset.
    let start = (ref.start * 2) + 2;

    bytecode = bytecode.substring(0, start) + linkId + bytecode.substring(start + 40);
  });

  return bytecode;
}

function orderABI(contract){
  let contractDefinition;
  let orderedFunctionNames = [];

  for (let i = 0; i < contract.legacyAST.children.length; i++) {
    let definition = contract.legacyAST.children[i];

    // AST can have multiple contract definitions, make sure we have the
    // one that matches our contract
    if (definition.name !== "ContractDefinition" ||
        definition.attributes.name !== contract.contract_name){
      continue;
    }

    contractDefinition = definition;
    break;
  }

  if (!contractDefinition) return contract.abi;
  if (!contractDefinition.children) return contract.abi;

  contractDefinition.children.forEach(function(child) {
    if (child.name === "FunctionDefinition") {
      orderedFunctionNames.push(child.attributes.name);
    }
  });

  // Put function names in a hash with their order, lowest first, for speed.
  let functionsToRemove = orderedFunctionNames.reduce(function (obj, value, index) {
    obj[value] = index;
    return obj;
  }, {});

  // Filter out functions from the abi
  let functionDefinitions = contract.abi.filter(function (item) {
    return functionsToRemove[item.name] != null;
  });

  // Sort removed function definitions
  functionDefinitions = functionDefinitions.sort(function(item_a, item_b) {
    var a = functionsToRemove[item_a.name];
    var b = functionsToRemove[item_b.name];

    if (a > b) return 1;
    if (a < b) return -1;
    return 0;
  });

  // Create a new ABI, placing ordered functions at the end.
  let newABI = [];
  contract.abi.forEach(function(item) {
    if (functionsToRemove[item.name] != null) return;
    newABI.push(item);
  });

  // Now pop the ordered functions definitions on to the end of the abi..
  Array.prototype.push.apply(newABI, functionDefinitions);

  return newABI;
}


// contracts_directory: String. Directory where .sol files can be found.
// quiet: Boolean. Suppress output. Defaults to false.
// strict: Boolean. Return compiler warnings as errors. Defaults to false.
compile.all = function(options, callback) {
  find_contracts(options.contracts_directory, function(err, files) {
    options.paths = files;
    compile.with_dependencies(options, callback);
  });
};

// contracts_directory: String. Directory where .sol files can be found.
// build_directory: String. Optional. Directory where .sol.js files can be found. Only required if `all` is false.
// all: Boolean. Compile all sources found. Defaults to true. If false, will compare sources against built files
//      in the build directory to see what needs to be compiled.
// quiet: Boolean. Suppress output. Defaults to false.
// strict: Boolean. Return compiler warnings as errors. Defaults to false.
compile.necessary = function(options, callback) {
  options.logger = options.logger || console;

  Profiler.updated(options, function(err, updated) {
    if (err) return callback(err);

    if (updated.length === 0 && options.quiet !== true) {
      return callback(null, [], {});
    }

    options.paths = updated;
    compile.with_dependencies(options, callback);
  });
};

compile.with_dependencies = function(options, callback) {
  options.logger = options.logger || console;
  options.contracts_directory = options.contracts_directory || process.cwd();

  expect.options(options, [
    "paths",
    "working_directory",
    "contracts_directory",
    "resolver"
  ]);

  const config = Config.default().merge(options);

  Profiler.required_sources(config.with({
    paths: options.paths,
    base_path: options.contracts_directory,
    resolver: options.resolver
  }), function(err, result) {
    if (err) return callback(err);

    if (options.quiet !== true) {
      Object.keys(result).sort().forEach(function(import_path) {
        let display_path = import_path;
        if (path.isAbsolute(import_path)) {
          display_path = "." + path.sep + path.relative(options.working_directory, import_path);
        }
        options.logger.log("Compiling " + display_path + "...");
      });
    }

    compile(result, options, callback);
  });
};

module.exports = compile;
