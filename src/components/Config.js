var fs = require("fs");
var _ = require("lodash");
var path = require("path");
var { constants } = require('./McashWrap');
var Provider = require("./Provider");
var TruffleError = require("@truffle/error");
var Module = require('module');
var findUp = require("find-up");
var originalrequire = require("original-require");

var DEFAULT_CONFIG_FILENAME = "config.js";

function Config(truffle_directory, working_directory, network) {
  var self = this;
  var default_tx_values = constants.deployParameters;
  this._values = {
    truffle_directory: truffle_directory || path.resolve(path.join(__dirname, "../")),
    working_directory: working_directory || process.cwd(),
    network: network,
    networks: {},
    verboseRpc: false,
    privateKey: null,
    fullHost: null,
    fullNode: null,
    solidityNode: null,
    eventServer: null,
    feeLimit: null,
    userFeePercentage: null,
    originEnergyLimit: null,
    tokenValue: null,
    tokenId: null,
    callValue: null,
    from: null,
    build: null,
    resolver: null,
    artifactor: null,
    ethpm: {
      ipfs_host: "ipfs.infura.io",
      ipfs_protocol: "https",
      registry: "0x8011df4830b4f696cd81393997e5371b93338878",
      install_provider_uri: "https://ropsten.infura.io/truffle"
    },
    solc: {
      optimizer: {
        enabled: false,
        runs: 200
      },
      evmVersion: "byzantium"
    },
    logger: {
      log: function () {
      },
    }
  };

  var props = {
    // These are already set.
    truffle_directory: function () {
    },
    working_directory: function () {
    },
    network: function () {
    },
    networks: function () {
    },
    verboseRpc: function () {
    },
    build: function () {
    },
    resolver: function () {
    },
    artifactor: function () {
    },
    ethpm: function () {
    },
    solc: function () {
    },
    logger: function () {
    },

    build_directory: function () {
      return path.join(self.working_directory, "build");
    },
    contracts_directory: function () {
      return path.join(self.working_directory, "contracts");
    },
    contracts_build_directory: function () {
      return path.join(self.build_directory, "contracts");
    },
    migrations_directory: function () {
      return path.join(self.working_directory, "migrations");
    },
    test_directory: function () {
      return path.join(self.working_directory, "test");
    },
    test_file_extension_regexp: function () {
      return /.*\.(js|es|es6|jsx|sol)$/
    },
    example_project_directory: function () {
      return path.join(self.truffle_directory, "example");
    },
    network_id: {
      get: function () {
        try {
          return self.network_config.network_id;
        } catch (e) {
          return null;
        }
      },
      set: function (val) {
        throw new Error("Do not set config.network_id. Instead, set config.networks and then config.networks[<network name>].network_id");
      }
    },
    network_config: {
      get: function () {
        var network = self.network;

        if (network == null) {
          throw new Error("Network not set. Cannot determine network to use.");
        }

        var conf = self.networks[network];

        if (conf == null) {
          config = {};
        }

        conf = _.extend({}, default_tx_values, conf);


        return conf;
      },
      set: function (val) {
        throw new Error("Don't set config.network_config. Instead, set config.networks with the desired values.");
      }
    },
    from: {
      get: function () {
        try {
          return self.network_config.from;
        } catch (e) {
          return default_tx_values.from;
        }
      },
      set: function (val) {
        throw new Error("Don't set config.from directly. Instead, set config.networks and then config.networks[<network name>].from")
      }
    },
    privateKey: {
      get: function () {
        try {
          return self.network_config.privateKey;
        } catch (e) {
          return default_tx_values.privateKey;
        }
      },
      set: function (val) {
        throw new Error("Don't set config.privateKey directly. Instead, set config.networks and then config.networks[<network name>].privateKey")
      }
    },
    fullNode: {
      get: function () {
        try {
          return self.network_config.fullNode;
        } catch (e) {
          return default_tx_values.fullNode;
        }
      },
      set: function (val) {
        throw new Error("Don't set config.fullNode directly. Instead, set config.networks and then config.networks[<network name>].fullNode")
      }
    },
    fullHost: {
      get: function () {
        try {
          return self.network_config.fullHost;
        } catch (e) {
          return default_tx_values.fullHost;
        }
      },
      set: function (val) {
        throw new Error("Don't set config.fullHost directly. Instead, set config.networks and then config.networks[<network name>].fullHost")
      }
    },
    solidityNode: {
      get: function () {
        try {
          return self.network_config.solidityNode;
        } catch (e) {
          return default_tx_values.solidityNode;
        }
      },
      set: function (val) {
        throw new Error("Don't set config.solidityNode directly. Instead, set config.networks and then config.networks[<network name>].solidityNode")
      }
    },
    eventServer: {
      get: function () {
        try {
          return self.network_config.eventServer;
        } catch (e) {
          return default_tx_values.eventServer;
        }
      },
      set: function (val) {
        throw new Error("Don't set config.eventServer directly. Instead, set config.networks and then config.networks[<network name>].eventServer")
      }
    },
    userFeePercentage: {
      get: function () {
        try {
          return self.network_config.userFeePercentage || self.network_config.consume_user_resource_percent;
        } catch (e) {
          return default_tx_values.userFeePercentage;
        }
      },
      set: function (val) {
        throw new Error("Don't set config.userFeePercentage directly. Instead, set config.networks and then config.networks[<network name>].userFeePercentage")
      }
    },
    feeLimit: {
      get: function () {
        try {
          return self.network_config.feeLimit || self.network_config.fee_limit;
        } catch (e) {
          return default_tx_values.feeLimit;
        }
      },
      set: function (val) {
        throw new Error("Don't set config.feeLimit directly. Instead, set config.networks and then config.networks[<network name>].feeLimit")
      }
    },
    originEnergyLimit: {
      get: function () {
        try {
          return self.network_config.originEnergyLimit;
        } catch (e) {
          return default_tx_values.originEnergyLimit;
        }
      },
      set: function (val) {
        throw new Error("Don't set config.originEnergyLimit directly. Instead, set config.networks and then config.networks[<network name>].originEnergyLimit")
      }
    },
    tokenValue: {
      get: function () {
        try {
          return self.network_config.tokenValue;
        } catch (e) {
          // no default value
        }
      },
      set: function (val) {
        throw new Error("Don't set config.tokenValue directly. Instead, set config.networks and then config.networks[<network name>].tokenValue")
      }
    },
    tokenId: {
      get: function () {
        try {
          return self.network_config.tokenId;
        } catch (e) {
          // no default value
        }
      },
      set: function (val) {
        throw new Error("Don't set config.tokenId directly. Instead, set config.networks and then config.networks[<network name>].tokenId")
      }
    },
    provider: {
      get: function () {
        if (!self.network) {
          return null;
        }

        let options = self.network_config;
        options.verboseRpc = self.verboseRpc;
        return Provider.create(options);
      },
      set: function (val) {
        throw new Error("Don't set config.provider directly. Instead, set config.networks and then set config.networks[<network name>].provider")
      }
    },
    callValue: {
      get: function () {
        try {
          return self.network_config.callValue || self.network_config.call_value;
        } catch (e) {
          return default_tx_values.callValue;
        }
      },
      set: function (val) {
        throw new Error("Don't set config.callValue directly. Instead, set config.networks and then config.networks[<network name>].callValue")
      }
    },
  };

  Object.keys(props).forEach(function (prop) {
    self.addProp(prop, props[prop]);
  });

}

Config.prototype.addProp = function (key, obj) {
  Object.defineProperty(this, key, {
    get: obj.get || function () {
      return this._values[key] || obj();
    },
    set: obj.set || function (val) {
      this._values[key] = val;
    },
    configurable: true,
    enumerable: true
  });
};

Config.prototype.normalize = function (obj) {
  let clone = {};
  Object.keys(obj).forEach(function (key) {
    try {
      clone[key] = obj[key];
    } catch (e) {
      // Do nothing with values that throw.
    }
  });
  return clone;
};

Config.prototype.with = function (obj) {
  let normalized = this.normalize(obj);
  let current = this.normalize(this);

  return _.extend({}, current, normalized);
};

Config.prototype.merge = function (obj) {
  let self = this;
  let clone = this.normalize(obj);

  // Only set keys for values that don't throw.
  Object.keys(obj).forEach(function (key) {
    try {
      self[key] = clone[key];
    } catch (e) {
      // Do nothing.
    }
  });

  return this;
};

Config.default = function () {
  return new Config();
};

Config.detect = function (options, filename) {
  let search;

  (!filename)
    ? search = [DEFAULT_CONFIG_FILENAME]
    : search = filename;

  let file = findUp.sync(search, {cwd: options.working_directory || options.workingDirectory});

  if (file == null) {
    throw new TruffleError("Could not find suitable configuration file.");
  }

  return this.load(file, options);
};

Config.load = function (file, options) {
  let config = new Config();

  config.working_directory = path.dirname(path.resolve(file));

  // The require-nocache module used to do this for us, but
  // it doesn't bundle very well. So we've pulled it out ourselves.
  delete require.cache[Module._resolveFilename(file, module)];
  let static_config = originalrequire(file);

  config.merge(static_config);
  config.merge(options);

  return config;
};

module.exports = Config;
