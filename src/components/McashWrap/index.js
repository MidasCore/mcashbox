const _McashWeb = require("mcashweb");
const chalk = require('chalk');
const constants = require('./constants');
const axios = require('axios');
const semver = require('semver');

let INSTANCE;

function McashWrap() {

  this._toNumber = toNumber;
  this.EventList = [];
  this.filterMatchFunction = filterMatchFunction;
  INSTANCE = this;
  return INSTANCE;
}

function toNumber(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    value = /^0x/.test(value) ? value : '0x' + value;
  } else {
    value = value.toNumber();
  }
  return value;
}

function filterMatchFunction(method, abi) {
  let methodObj = abi.filter((item) => item.name === method);
  if (!methodObj || methodObj.length === 0) {
    return null;
  }
  methodObj = methodObj[0];
  let parametersObj = methodObj.inputs.map((item) => item.type);
  return {
    function: methodObj.name + '(' + parametersObj.join(',') + ')',
    parameter: parametersObj,
    methodName: methodObj.name,
    methodType: methodObj.type
  }
}

function sleep(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

function filterNetworkConfig(options) {
  let userFeePercentage =
    typeof options.userFeePercentage === 'number'
      ? options.userFeePercentage
      : typeof options.consume_user_resource_percent === 'number'
      ? options.consume_user_resource_percent
      : constants.deployParameters.userFeePercentage;
  return {
    fullNode: options.fullNode || options.fullHost,
    feeLimit: options.feeLimit || options.fee_limit || constants.deployParameters.feeLimit,
    originEnergyLimit: options.originEnergyLimit || options.origin_energy_limit || constants.deployParameters.originEnergyLimit,
    callValue: options.callValue || options.call_value || constants.deployParameters.callValue,
    tokenValue: options.tokenValue || options.token_value || options.call_token_value,
    tokenId: options.tokenId || options.token_id,
    userFeePercentage
  }
}

function init(options, extraOptions) {

  if (INSTANCE) {
    return INSTANCE;
  }

  if (extraOptions.verify && (
    !options || !options.privateKey || !(
      options.fullHost || (options.fullNode && options.solidityNode && options.eventServer)
    )
  )) {
    if (!options) {
      throw new Error('It was not possible to instantiate McashWeb. The chosen network does not exist in your "config.js".')
    } else {
      throw new Error('It was not possible to instantiate McashWeb. Some required parameters are missing in your "config.js".')
    }
  }

  McashWrap.prototype = new _McashWeb(
    options.fullNode || options.fullHost,
    options.solidityNode || options.fullHost,
    options.eventServer || options.fullHost,
    options.privateKey
  );

  const mcashWrap = McashWrap.prototype;

  mcashWrap.networkConfig = filterNetworkConfig(options);
  if (extraOptions.log) {
    mcashWrap._log = extraOptions.log;
  }

  mcashWrap._getNetworkInfo = async function () {
    let info = {
      javaVersion: 'unknown',
      compilerVersion: '0.4.25'
    };
    try {
      const nodeInfo = await mcashWrap.mcash.getNodeInfo();

      if (nodeInfo) {
        info.javaVersion = nodeInfo.configNodeInfo.codeVersion;
        if (semver.gte(info.javaVersion, '0.2.0')) {
          info.compilerVersion = '0.5.4'
        }
      }
    } catch (err) {
    }
    return Promise.resolve(info)
  };

  mcashWrap._getNetwork = function (callback) {
    callback && callback(null, options.network_id);
  };

  const defaultAddress = mcashWrap.address.fromPrivateKey(mcashWrap.defaultPrivateKey);
  mcashWrap._accounts = [defaultAddress];
  mcashWrap._privateKeyByAccount = {};
  mcashWrap._privateKeyByAccount[defaultAddress] = mcashWrap.defaultPrivateKey;

  // Todo: quickstart
  mcashWrap._getAccounts = function (callback) {

    const self = this;

    return new Promise((accept, reject) => {
      function cb() {
        if (callback) {
          callback(null, self._accounts);
          accept();
        } else {
          accept(self._accounts);
        }
      }

      if (self._accountsRequested) {
        return cb();
      }

      return axios.get(self.networkConfig.fullNode + '/admin/accounts-json')
        .then(({data}) => {
          data = Array.isArray(data) ? data : data.privateKeys;
          if (data.length > 0 && data[0].length === 64) {
            self._accounts = [];
            self._privateKeyByAccount = {};
            for (let account of data) {
              let address = this.address.fromPrivateKey(account);
              self._privateKeyByAccount[address] = account;
              self._accounts.push(address)
            }
          }
          self._accountsRequested = true;
          return cb();
        })
        .catch(err => {
          self._accountsRequested = true;
          return cb();
        })
    })
  };

  mcashWrap._getContract = async function (address, callback) {
    const contractInstance = await mcashWrap.mcash.getContract(address || "");
    if (contractInstance) {
      callback && callback(null, contractInstance.contract_address);
    } else {
      callback(new Error("no code"))
    }
  };

  mcashWrap._deployContract = function (option, callback) {

    const myContract = this.contract();
    let originEnergyLimit = option.originEnergyLimit || this.networkConfig.originEnergyLimit;
    if (originEnergyLimit < 0 || originEnergyLimit > constants.deployParameters.originEnergyLimit) {
      throw new Error('Origin Energy Limit must be > 0 and <= 100,000,000,000');
    }

    let userFeePercentage = typeof options.userFeePercentage === 'number'
      ? options.userFeePercentage
      : this.networkConfig.userFeePercentage;

    this._new(myContract, {
      bytecode: option.data,
      feeLimit: option.feeLimit || this.networkConfig.feeLimit,
      callValue: option.callValue || this.networkConfig.callValue,
      userFeePercentage,
      originEnergyLimit,
      abi: option.abi,
      parameters: option.parameters,
      name: option.contractName
    }, option.privateKey)
      .then(result => {
        callback(null, myContract);
        option.address = myContract.address;
      }).catch(function (reason) {
      callback(new Error(reason));
    });
  };

  mcashWrap._new = async function (myContract, options, privateKey = mcashWrap.defaultPrivateKey, callback) {

    let signedTransaction;
    try {
      const address = mcashWrap.address.fromPrivateKey(privateKey);
      const transaction = await mcashWrap.transactionBuilder.createSmartContract(options, address);
      signedTransaction = await mcashWrap.mcash.sign(transaction, privateKey);
      const result = await mcashWrap.mcash.sendRawTransaction(signedTransaction);

      if (!result || typeof result !== 'object') {
        throw new Error(`Error while broadcasting the transaction to create the contract ${options.name}. Most likely, the creator has either insufficient bandwidth or energy.`);
      }

      if (result.code) {
        throw new Error(`${result.code} (${mcashWrap.toUtf8(result.message)}) while broadcasting the transaction to create the contract ${options.name}`)
      }

      let contract;
      dlog('Contract broadcasted', {
        result: result.result,
        transaction_id: transaction.tx_id,
        address: transaction.contract_address
      });
      for (let i = 0; i < 10; i++) {
        try {
          dlog('Requesting contract');
          contract = await mcashWrap.mcash.getContract(signedTransaction.contract_address);
          dlog('Contract requested');
          if (contract.contract_address) {
            dlog('Contract found');
            break;
          }
        } catch (err) {
          dlog('Contract does not exist');
        }
        await sleep(500);
      }

      dlog('Reading contract data');

      if (!contract || !contract.contract_address) {
        throw new Error('Contract does not exist');
      }

      myContract.address = contract.contract_address;
      myContract.bytecode = contract.bytecode;
      myContract.deployed = true;

      myContract.loadAbi(contract.abi.entrys);

      dlog('Contract deployed');
      return myContract;

    } catch (ex) {
      if (ex.toString().includes('does not exist')) {
        let url = this.networkConfig.fullNode + '/wallet/gettransactionbyid?value=' + signedTransaction.tx_id;

        ex = 'Contract ' + chalk.bold(options.name) + ' has not been deployed on the network.\nFor more details, check the transaction at:\n' + chalk.blue(url) +
          '\nIf the transaction above is empty, most likely, your address had no bandwidth/energy to deploy the contract.'
      }
      throw ex;
    }
  };

  mcashWrap.triggerContract = function (option, callback) {
    let myContract = this.contract(option.abi, option.address);
    let callSend = 'send'; // constructor and fallback
    option.abi.forEach(function (val) {
      if (val.name === option.methodName) {
        callSend = /payable/.test(val.stateMutability) ? 'send' : 'call'
      }
    });
    option.methodArgs || (option.methodArgs = {});
    option.methodArgs.from || (option.methodArgs.from = this._accounts[0]);

    dlog(option.methodName, option.args, options.methodArgs);

    let privateKey;
    if (callSend === 'send' && option.methodArgs.from) {
      privateKey = this._privateKeyByAccount[option.methodArgs.from]
    }

    this._getNetworkInfo()
      .then(info => {
        // TODO: check allow vm transfer M1
        // if (info.compilerVersion === '1') {
        //   delete option.methodArgs.tokenValue;
        //   delete option.methodArgs.tokenId
        // }
        return myContract[option.methodName](...option.args)[callSend](option.methodArgs || {}, privateKey)
      })
      .then(function (res) {
        callback(null, res)
      }).catch(function (reason) {
      if (typeof reason === 'object' && reason.error) {
        reason = reason.error
      }
      if (process.env.CURRENT === 'test') {
        callback(reason)
      } else {
        logErrorAndExit(console, reason)
      }
    });
  };

  return new McashWrap;
}


const logErrorAndExit = (logger, err) => {

  function log(str) {
    try {
      logger.error(str)
    } catch (err) {
      console.error(str)
    }
  }

  let msg = typeof err === 'string' ? err : err.message;
  if (msg) {
    msg = msg.replace(/^error(:|) /i, '');
    if (msg === 'Invalid URL provided to HttpProvider') {
      msg = 'Either invalid or wrong URL provided to HttpProvider. Verify the configuration in your "config.js"'
    }
    log(chalk.red(chalk.bold('ERROR:'), msg));
  } else {
    log("Error encountered, bailing. Network state unknown.");
  }
  process.exit();
};

const dlog = function (...args) {
  if (process.env.DEBUG_MODE) {
    for (let i = 0; i < args.length; i++) {

      if (typeof args[i] === 'object') {
        try {
          args[i] = JSON.stringify(args[i], null, 2)
        } catch (err) {
        }
      }
    }
    console.log(chalk.blue(args.join(' ')))
  }
};


module.exports = init;

module.exports.config = () => console.log('config');
module.exports.constants = constants;
module.exports.logErrorAndExit = logErrorAndExit;
module.exports.dlog = dlog;
module.exports.sleep = sleep;
module.exports.McashWeb = _McashWeb;

