# McashBox
**McashBox is a fork of [TronBox](https://github.com/tron-us/tronbox) and [Truffle](https://www.trufflesuite.com/truffle)**

## Installation
`npm install -g mcashbox`
## OS requirement
- NodeJS 8.0+
- Windows, Linux, or Mac OS X

## Features
Initialize a McashBox Project<br>
```mcashbox init```

Contract Compiler<br>
```mcashbox compile```

To compile for all contracts, add option ```--compile-all```.

Optionally, you can select: <br>
`--compile-all`: Force compile all contracts. <br>
`--network`: Save results to a specific host network<br>
<br>

## Configuration
To use McashBox, your dApp has to have a file `config.js` in the source root. This special files, tells McashBox how to connect to nodes, and passes some special parameters, like the default private key. This is an example of `config.js`:
```
const port = process.env.HOST_PORT || 13399;

module.exports = {
    networks: {
        mainnet: {
            privateKey: process.env.PRIVATE_KEY_MAINNET,
            userFeePercentage: 100,
            feeLimit: 1e9,
            fullHost: "https://mainnet.mcash.network",
            network_id: "1"
        },
        testnet: {
            privateKey: process.env.PRIVATE_KEY_TESTNET,
            userFeePercentage: 50,
            feeLimit: 1e9,
            fullHost: "https://testnet.mcash.network",
            network_id: "3",
        },
        development: {
            // For local
            privateKey: '261b559a288dbeffdea44225b30dab6246bb2eaeb23c1ff9283cb74a716f0c5c',
            userFeePercentage: 50,
            feeLimit: 1e9,
            fullHost: 'http://127.0.0.1:' + port,
            network_id: "19",
        }
    }
};
```

## Contract Migration<br>
`mcashbox migrate`
<br>

This command will invoke all migration scripts within the migrations directory. If your previous migration was successful, `mcashbox migrate` will invoke a newly created migration. If there is no new migration script, this command will have no operational effect. Instead, you can use the option `--reset` to restart the migration script.<br>

`mcashbox migrate --reset`
<br>

## Start Console<br>
This will use the default network to start a console. It will automatically connect to a VM client. You can use `--network` to change this. <br>

`mcashbox console`<br>

The console supports the `mcashbox` command. For example, you can invoke `migrate --reset` in the console. The result is the same as invoking `mcashbox migrate --reset` in the command.
<br>

## Extra Features in McashBox console:<br>

1. All the compiled contracts can be used, just like in development & test, front-end code, or during script migration. <br>

2. After each command, your contract will be re-loaded. After invoking the `migrate --reset` command, you can immediately use the new address and binary.<br>

3. Every returned command's promise will automatically be logged. There is no need to use `then()`, which simplifies the command.<br>

## Solc versions

McashBox supports all the Solidity versions.
```
0.4.25
0.4.26
0.5.4
0.5.8
```
