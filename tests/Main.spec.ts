import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Main } from '../wrappers/Main';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Main', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Main');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let owner: SandboxContract<TreasuryContract>;
    let main: SandboxContract<Main>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        owner = await blockchain.treasury('owner');

        main = blockchain.openContract(Main.createFromConfig({
            number: 1337,
            address: deployer.address,
            owner_address: owner.address
        }, code));


        const deployResult = await main.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: main.address,
            deploy: true,
            success: true,
        });
    });

    it('should increment value by 1', async () => {
        const IncrementValueTransactions = await main.sendIncrement(deployer.getSender(), toNano("0.05"), 1)
        expect(IncrementValueTransactions.transactions).toHaveTransaction({
            from: deployer.address,
            to: main.address,
            success: true
        })
    });
    it("should get data from contract", async () => {

        const IncrementValueTransactions = await main.sendIncrement(deployer.getSender(), toNano("0.05"), 1)

        expect(IncrementValueTransactions.transactions).toHaveTransaction({
            from: deployer.address,
            to: main.address,
            success: true
        })

        const data = await main.getData()

        expect(data.number).toEqual(1338)
        expect(data.recent_address.toString()).toBe(deployer.address.toString())
    })
    it("should successfuly deposit", async () => {
        const senderWallet = await blockchain.treasury('sender')

        const depositMessageResult = await main.sendNoCodeDeposit(senderWallet.getSender(), toNano("5"))

        expect(depositMessageResult.transactions).toHaveTransaction({
            from: senderWallet.address,
            to: main.address,
            success: true
        })

        const balanceRequests = await main.getBalance();

        expect(balanceRequests.balance).toBeGreaterThan(toNano("4.99"))
    })

    it("successfully withdraws funds on behalf of owner", async () => {
        const senderWallet = await blockchain.treasury("sender")

        await main.sendDeposit(senderWallet.getSender(), toNano("5"))

        const withdrawalRequestResult = await main.sendWithdrawalRequest(
            owner.getSender(),
            toNano("0.05"),
            toNano("1")
        )

        expect(withdrawalRequestResult.transactions).toHaveTransaction({
            from: main.address,
            to: owner.address,
            success: true,
            value: toNano("1")
        })
    })
    it("should fail to withdraw funds on behalf of non-owner", async () => {
        const senderWallet = await blockchain.treasury("sender")
        await main.sendDeposit(senderWallet.getSender(), toNano("5"))

        const withdrawalRequestResult = await main.sendWithdrawalRequest(senderWallet.getSender(), toNano("0.5"), toNano("1"))
        expect(withdrawalRequestResult.transactions).toHaveTransaction({
            from: senderWallet.address,
            to: main.address,
            success: false,
            exitCode: 103
        })
    })

    it("should fail to withdraw funds because lack of balance", async () => {
        const withdrawalRequestResult = await main.sendWithdrawalRequest(owner.getSender(), toNano("0.05"), toNano("1"))
        expect(withdrawalRequestResult.transactions).toHaveTransaction({
            from: owner.address,
            to: main.address,
            success: false,
            exitCode: 104
        })
    })

});
