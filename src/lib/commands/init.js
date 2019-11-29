var command = {
  command: 'init',
  description: 'Initialize new and empty mcashbox project',
  builder: {},
  run: function (options, done) {
    process.env.CURRENT = 'init';
    var Config = require("../../components/Config");
    var OS = require("os");
    var UnboxCommand = require("./unbox");

    var config = Config.default().with({
      logger: console
    });

    if (options._ && options._.length > 0) {
      config.logger.log(
        "Error: `mcashbox init` no longer accepts a project template name as an argument."
      );
      config.logger.log();
      config.logger.log(
        " - For an empty project, use `mcashbox init` with no arguments" +
        OS.EOL
      );
      process.exit(1);
    }

    // defer to `truffle unbox` command with "bare" box as arg
    var url = "https://github.com/nghiand/mcashbox-init-bare.git";
    options._ = [url];

    UnboxCommand.run(options, done);
  }
};

module.exports = command;
