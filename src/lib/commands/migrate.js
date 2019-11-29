const command = {
  command: 'migrate',
  description: 'Run migrations to deploy contracts',
  builder: {
    reset: {
      type: "boolean",
      default: false
    },
    "compile-all": {
      describe: "recompile all contracts",
      type: "boolean",
      default: false
    },
    // "dry-run": {
    //   describe: "Run migrations against an in-memory fork, for testing",
    //   type: "boolean",
    //   default: false
    // },
    f: {
      describe: "Specify a migration number to run from",
      type: "number"
    }
  },
  run: function (options, done) {
    process.env.CURRENT = 'migrate';
    const OS = require("os");
    const Config = require("../../components/Config");
    const Contracts = require("../../components/WorkflowCompile");
    const Migrate = require("../../components/Migrate");
    const Environment = require("../environment");
    const McashWrap = require("../../components/McashWrap");
    const {dlog} = require("../../components/McashWrap");
    const logErrorAndExit = require('../../components/McashWrap').logErrorAndExit;

    let config = Config.detect(options);

    // if "development" exists, default to using that
    if (!config.network && config.networks.development) {
      config.network = "development";
    }
    // init mcashweb
    try {
      McashWrap(config.networks[config.network], {
        verify: true,
        log: options.log
      })
    } catch (err) {
      logErrorAndExit(console, err.message)
    }

    //
    // function setupDryRunEnvironmentThenRunMigrations(callback) {
    //   Environment.fork(config, function(err) {
    //     if (err) return callback(err);
    //
    //     // Copy artifacts to a temporary directory
    //     temp.mkdir('migrate-dry-run-', function(err, temporaryDirectory) {
    //       if (err) return callback(err);
    //
    //       function cleanup() {
    //         var args = arguments;
    //         // Ensure directory cleanup.
    //         temp.cleanup(function(err) {
    //           // Ignore cleanup errors.
    //           callback.apply(null, args);
    //         });
    //       };
    //
    //       copy(config.contracts_build_directory, temporaryDirectory, function(err) {
    //         if (err) return callback(err);
    //
    //         config.contracts_build_directory = temporaryDirectory;
    //
    //         // Note: Create a new artifactor and resolver with the updated config.
    //         // This is because the contracts_build_directory changed.
    //         // Ideally we could architect them to be reactive of the config changes.
    //         config.artifactor = new Artifactor(temporaryDirectory);
    //         config.resolver = new Resolver(config);
    //
    //         runMigrations(cleanup);
    //       });
    //     });
    //   });
    // }

    function runMigrations(callback) {
      if (options.f) {
        Migrate.runFrom(options.f, config, done);
      } else {
        Migrate.needsMigrating(config, function (err, needsMigrating) {
          if (err) return callback(err);

          if (needsMigrating) {
            dlog('Starting migration');
            Migrate.run(config, done);
          } else {
            config.logger.log("Network up to date.");
            callback();
          }
        });
      }
    }

    Contracts.compile(config, function (err) {
      if (err) return done(err);
      Environment.detect(config, function (err) {
        if (err) return done(err);
        let dryRun = options.dryRun === true;

        let networkMessage = "Using network '" + config.network + "'";

        if (dryRun) {
          networkMessage += " (dry run)";
        }

        config.logger.log(networkMessage + "." + OS.EOL);

        // if (dryRun) {
        //   setupDryRunEnvironmentThenRunMigrations(done);
        // } else {
        runMigrations(done);
        // }
      });
    });
  }
};

module.exports = command;
