// setting up chai as following
// so that revertedWith can be called without error
const chai = require("chai");
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { expect } = chai;

const { ethers } = require("hardhat");
const { DateTime } = require("luxon");

const { timeToBigNumber, expectEvent, expectException } = require("./helpers");

// MUST be in sync with BetOracle.SportKind
const SportKind = {
  Soccer: 0,
  Rugby: 1,
  Basketball: 2
};

describe("Bet", function () {
  let dai, bet, betOracle;

  beforeEach("Create contracts", async function () {
    const DAI = await ethers.getContractFactory("DAI");
    dai = await DAI.deploy("Dai Stablecoin", "DAI");
    await dai.deployed();

    const Bet = await ethers.getContractFactory("Bet");
    bet = await Bet.deploy(dai.address);
    await bet.deployed();

    const BetOracle = await ethers.getContractFactory("BetOracle");
    betOracle = await BetOracle.deploy();
    await betOracle.deployed();
  });

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Contract Ownership
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  describe("Contract Ownership", function () {
    it("has an owner", async function () {
      const [deployer] = await ethers.getSigners();
      expect(await bet.owner()).to.equal(deployer.address);
    });

    it("can transfer ownership", async function () {
      const [deployer, customer] = await ethers.getSigners();
      const tx = await bet.transferOwnership(customer.address);
      await expectEvent(tx, "OwnershipTransferred", {
        previousOwner: deployer.address,
        newOwner: customer.address
      });
      expect(await bet.owner()).to.equal(customer.address);
    });

    it("can renounce ownership if owner", async function () {
      const [deployer] = await ethers.getSigners();
      const tx = await bet.renounceOwnership();
      await expectEvent(tx, "OwnershipTransferred", {
        previousOwner: deployer.address,
        newOwner: ethers.constants.AddressZero
      });
      expect(await bet.owner()).to.equal(ethers.constants.AddressZero);
    });

    it("cannot renounce ownership if NOT owner", async function () {
      const [deployer, customer, guest] = await ethers.getSigners();
      const tx = bet.connect(guest).renounceOwnership();
      await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Oracle Handling (Set and Get)
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  describe("Oracle Handling", function () {
    it("can setOracleAddress if owner", async function () {
      const tx = await bet.setOracleAddress(betOracle.address);
      await expectEvent(tx, "OracleAddressSet", {
        oracleAddress: betOracle.address
      });
      await tx.wait();
      expect(await bet.getOracleAddress()).to.equal(betOracle.address);
    });

    it("cannot setOracleAddress if NOT owner", async function () {
      const [deployer, customer, guest] = await ethers.getSigners();
      const promise = bet.connect(guest).setOracleAddress("0x1234567890123456789012345678901234567890");
      await expect(promise).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("cannot setOracleAddress 0", async function () {
      const promise = bet.setOracleAddress(ethers.constants.AddressZero);
      await expect(promise).to.be.revertedWith("Address 0 is not allowed");
    });

    specify.skip("setOracleAddress to a non BetOracle address should revert but halts instead", async function () {
      const promise = bet.setOracleAddress(bet.address);
      await expectException(promise, "revert");
    });

    specify("testOracleConnection returns true when an BetOracle is connected", async function () {
      const tx = await bet.setOracleAddress(betOracle.address);
      await expectEvent(tx, "OracleAddressSet", {
        _address: betOracle.address
      });
      await tx.wait();
      const isOracleConnected = await bet.testOracleConnection();
      expect(isOracleConnected).to.be.true;
    });

    specify("testOracleConnection returns false when an BetOracle is NOT connected", async function () {
      // BetOracle address not set
      // Bet.setOracleAddress not called
      expect(await bet.getOracleAddress()).to.equal(ethers.constants.AddressZero);
      const isOracleConnected = await bet.testOracleConnection();
      expect(isOracleConnected).to.be.false;
    });
  });

  describe("Bet on Sport Events", function () {
    const events = [];

    beforeEach("Add Sport Events", async function () {
      // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      // Add 2 events into the Oracle
      // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~

      // Event0
      events.push({
        date: timeToBigNumber(DateTime.now().plus({ days: 7, minutes: 7 })),
        name: "Paris vs. Marseille",
        teams: "PSG|OM",
        teamsCount: 2,
        kind: SportKind.Soccer
      });
      events[0].tx = await betOracle.addSportEvent(
        events[0].name,
        events[0].teams,
        events[0].teamsCount,
        events[0].date,
        events[0].kind
      );
      // Rebuild in JS the eventId (returned by BetOracle.addSportEvent, keccak256)
      events[0].id = ethers.utils.solidityKeccak256(
        ["string", "uint8", "uint256", "uint8"],
        [events[0].name, events[0].teamsCount, events[0].date, events[0].kind]
      );

      // Event1
      events.push({
        date: timeToBigNumber(DateTime.now().plus({ days: 14, minutes: 14 })),
        name: "Spain vs. Portugal",
        teams: "ES|PT",
        teamsCount: 2,
        kind: SportKind.Rugby
      });
      events[1].tx = await betOracle.addSportEvent(
        events[1].name,
        events[1].teams,
        events[1].teamsCount,
        events[1].date,
        events[1].kind
      );
      // Rebuild in JS the eventId (returned by BetOracle.addSportEvent, keccak256)
      events[1].id = ethers.utils.solidityKeccak256(
        ["string", "uint8", "uint256", "uint8"],
        [events[1].name, events[1].teamsCount, events[1].date, events[1].kind]
      );
    });

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Sport Events
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    describe("Sport Events", function() {
      it.skip("getEvent: can get an existing event using its id", async function () {
        const [deployer, customer] = await ethers.getSigners();
        const tx = await bet.connect(customer).getEvent(events[0].id);
        expect(tx.id).to.equal(events[0].id);
        expect(tx.name).to.be.a("string").equal(events[0].name);
        expect(tx.participants).to.be.a("string").equal(events[0].teams);
        expect(tx.participantCount).to.be.a("number").equal(events[0].teamsCount);
        // chai-bignumber doesn't support the latest version of bignumber
        expect(tx.date).to.equal(events[0].date);
        expect(tx.kind).to.be.a("number").equal(events[0].kind);
        expect(tx.outcome).to.be.a("number").equal(EventOutcome.Pending);
        expect(tx.winner).to.be.a("number").equal(-1);
      });

      it("getEvent: returns a specially crafted event when requresting a non existing event");

      it.skip("can getLatestEvent", async function() {
        const [deployer, customer] = await ethers.getSigners();
        const evt = await bet.connect(customer).getLatestEvent();
        expect(evt.id).to.equal(events[1].id);
        expect(evt.name).to.be.a("string").equal(events[1].name);
        expect(evt.participants).to.be.a("string").equal(events[1].teams);
        expect(evt.participantCount).to.be.a("number").equal(events[1].teamsCount);
        // chai-bignumber doesn't support the latest version of bignumber
        expect(evt.date).to.equal(events[1].date);
        expect(evt.kind).to.be.a("number").equal(events[1].kind);
        expect(evt.outcome).to.be.a("number").equal(EventOutcome.Pending);
        expect(evt.winner).to.be.a("number").equal(-1);
      });

      it("can getBettableEvents", async function () {
        const tx = await bet.setOracleAddress(betOracle.address);
        await tx.wait();
        const [deployer, customer] = await ethers.getSigners();
        const eventIds = await bet.connect(customer).getBettableEvents();
        for (let i = 0; i < eventIds.length; i++) {
          // getBettableEvents outputs events in LIFO order
          expect(eventIds[eventIds.length - i - 1]).to.equal(events[i].id);
        }
      });

      it("can test if a bet is valid");
      it("can check if _eventOpenForBetting");
    });

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Bets
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    describe("Bets", function () {
      it.skip("cannot placeBet when amount < minimumBet", async function () {
        // For whatever reason I receive "sender account is not recognized" in the test environment
        // whereas I expected "Bet amount must be >= minimum bet"
        // TODO: Remove the corresponding require in the contract if it is useless and this is an expected behavior
        const [deployer] = await ethers.getSigners();
        const promise = bet.placeBet(
          events[0].id,
          1,
          {
            from: deployer.address,
            value: ethers.utils.parseEther("0.01")
          }
        );
        await expect(promise).to.be.revertedWith("Bet amount must be >= minimum bet");
      });

      it.skip("cannot placeBet if event does not exist", async function() {
        const [deployer] = await ethers.getSigners();
        const nonExistingEventId = ethers.utils.solidityKeccak256([], []);
        const promise = bet.placeBet(nonExistingEventId, 1, {
          from: deployer.address,
          value: ethers.utils.parseEther("0.25")
        });
        await expectException(promise, "revert");
      });

      it("cannot placeBet if event not open for betting");

      it("can placeBet", async function () {
        const oracleTx = await bet.setOracleAddress(betOracle.address);
        await oracleTx.wait();

        const [deployer] = await ethers.getSigners();
        const amount = ethers.utils.parseEther("0.25");
        const betTx = await bet.placeBet(events[0].id, 1, {
          from: deployer.address,
          value: amount
        });
        expectEvent(betTx, "BetPlaced", {
          _eventId: events[0].id,
          _player: deployer.address,
          _chosenWinner: 1,
          _amount: amount
        });
        await betTx.wait();

        const bettedEvents = await bet.getBettedEvents();
        console.log("bettedEvents", bettedEvents);

        const payload = await bet.getBetPayload(events[0].id);
        expect(payload.chosenWinner).to.be.a("number").equal(1);
      });
    });

    it("can cancelBet", async function () {
      const oracleTx = await bet.setOracleAddress(betOracle.address);
      await oracleTx.wait();

      const [deployer] = await ethers.getSigners();
      const amount = ethers.utils.parseEther("0.25");

      const betTx = await bet.placeBet(events[0].id, 1, {
        from: deployer.address,
        value: amount
      });
      expectEvent(betTx, "BetPlaced", {
        _eventId: events[0].id,
        _player: deployer.address,
        _chosenWinner: 1,
        _amount: amount
      });
      await betTx.wait();

      const cancelTx = await bet.cancelBet(events[0].id);
      expectEvent(cancelTx, "BetCancelled", {
        _eventId: events[0].id,
        _player: deployer.address,
        _amount: amount
      });
      await cancelTx.wait();
    });
  });

  describe("DAI", function () {
    it.skip("getContractDAIBalance()", async function () {
      console.log(await bet.getContractDAIBalance());
    });
    it("deposit");
    it("approve");
  });
});
