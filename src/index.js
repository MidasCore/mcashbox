require('source-map-support/register');

var Config = require("./components/Config");
const Command = require("./lib/command");
const TaskError = require("./lib/errors/taskerror");
const TruffleError = require("@truffle/error");
const version = require("./lib/version");
const OS = require("os");
const downloader = require("./downloader");

const commands = process.argv.slice(2);

if (commands[0] === '--download-compiler' && commands[1]) {

  downloader(commands[1])

} else {

  const command = new Command(require("./lib/commands"));

  let options = {
    logger: console
  };

  command.run(process.argv.slice(2), options, function (err) {
    if (err) {
      if (err instanceof TaskError) {
        command.args
          .usage("Mcashbox v" + (version.bundle || version.core) +
            + OS.EOL + OS.EOL
            + 'Usage: mcashbox <command> [options]')
          .epilog("See more at https://developer.mcash.network/docs/mcashbox")
          .showHelp();
      } else {
        if (err instanceof TruffleError) {
          console.log(err.message);
        } else if (typeof err == "number") {
          // If a number is returned, exit with that number.
          process.exit(err);
        } else {
          // Bubble up all other unexpected errors.
          console.log(err.stack || err.toString());
        }
      }
      process.exit(1);
    }

    // Don't exit if no error; if something is keeping the process open,
    // like `truffle console`, then let it.

    // Clear any polling or open sockets - `provider-engine` in HDWallet
    // and `web3 1.0 confirmations` both leave interval timers etc wide open.
    const handles = process._getActiveHandles();
    handles.forEach(handle => {
      if (typeof handle.close === 'function') {
        handle.close();
      }
    })
  });

}
