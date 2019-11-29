const port = process.env.HOST_PORT || 8090;

/*
Create a .env file (it must be gitignored)
    export PRIVATE_KEY_MAINNET=
Then, run the migration with:
    source .env && mcashbox migrate --network mainnet
*/
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
