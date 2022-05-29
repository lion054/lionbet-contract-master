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

// MUST be in sync with BetOracle.EventOutcome
const EventOutcome = {
  Pending: 0,
  Underway: 1,
  Draw: 2,
  Decided: 3
};

describe("BetOracle", function () {
  let betOracle;

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Instantiate a new contract before running each test in this suite
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  beforeEach("Create Oracle", async function() {
    const BetOracle = await ethers.getContractFactory("BetOracle");
    betOracle = await BetOracle.deploy();
    await betOracle.deployed();
  });

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Declaring Events in the Oracle
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  describe("Adding Events", function () {
    it("can addSportEvent if OWNER", async function () {
      const evt = {
        date: timeToBigNumber(DateTime.now().plus({ days: 7, minutes: 7 })),
        name: "Paris vs. Marseille",
        teams: "PSG|OM",
        teamsCount: 2,
        kind: SportKind.Soccer
      };
      const tx = await betOracle.addSportEvent(
        evt.name,
        evt.teams,
        evt.teamsCount,
        evt.date,
        evt.kind
      );

      // Recompute `eventId` in javascript (the hash built with and returned by BetOracle.addSportEvent using Solidity keccak256())
      const expectedEventId = ethers.utils.solidityKeccak256(
        ["string", "uint8", "uint256", "uint8"],
        [evt.name, evt.teamsCount, evt.date, evt.kind]
      );

      expectEvent(tx, "SportEventAdded", {
        _eventId: expectedEventId,
        _name: evt.name,
        _participants: evt.teams,
        _participantCount: evt.teamsCount,
        _date: evt.date,
        _kind: evt.kind,
        _eventOutcome: EventOutcome.Pending,
        _winner: ethers.constants.NegativeOne
      });

      const receipt = await tx.wait();
      const actualEventId = receipt.events[0].args[0];
      expect(actualEventId).to.equal(expectedEventId);
    });

    it("cannot addSportEvent if NOT owner", async function() {
      const evt = {
        date: timeToBigNumber(DateTime.now().plus({ days: 7, minutes: 7 })),
        name: "Paris vs. Marseille",
        teams: "PSG|OM",
        teamsCount: 2,
        kind: SportKind.Rugby
      };

      const [deployer, customer, guest] = await ethers.getSigners();
      const promise = betOracle.connect(guest).addSportEvent(
        evt.name,
        evt.teams,
        evt.teamsCount,
        evt.date,
        evt.kind
      );
      await expect(promise).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("cannot add an existing Event", async function() {
      const evt = {
        date: timeToBigNumber(DateTime.now().plus({ days: 7, minutes: 7 })),
        name: "Paris vs. Marseille",
        teams: "PSG|OM",
        teamsCount: 2,
        kind: SportKind.Basketball
      };

      await betOracle.addSportEvent(
        evt.name,
        evt.teams,
        evt.teamsCount,
        evt.date,
        evt.kind
      );

      const promise = betOracle.addSportEvent(
        evt.name,
        evt.teams,
        evt.teamsCount,
        evt.date,
        evt.kind
      );
      await expect(promise).to.be.revertedWith("Event already exists");
    });
  });

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Getting Event(s) from the Oracle
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  describe("Getting Events", function() {
    const events = [];

    beforeEach("Create 3 events", async function () {
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
      // Rebuild in JS the keccak256 returned by BetOracle.addSportEvent when adding event
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
      // Rebuild in JS the keccak256 returned by BetOracle.addSportEvent when adding event
      events[1].id = ethers.utils.solidityKeccak256(
        ["string", "uint8", "uint256", "uint8"],
        [events[1].name, events[1].teamsCount, events[1].date, events[1].kind]
      );

      // Event2
      events.push({
        date: timeToBigNumber(DateTime.now().plus({ days: 21, minutes: 21 })),
        name: "France vs. Bresil",
        teams: "FR|BR",
        teamsCount: 2,
        kind: SportKind.Basketball
      });
      events[2].tx = await betOracle.addSportEvent(
        events[2].name,
        events[2].teams,
        events[2].teamsCount,
        events[2].date,
        events[2].kind
      );
      // Rebuild in JS the keccak256 returned by BetOracle.addSportEvent when adding event
      events[2].id = ethers.utils.solidityKeccak256(
        ["string", "uint8", "uint256", "uint8"],
        [events[2].name, events[2].teamsCount, events[2].date, events[2].kind]
      );
    });

    it("getEvent: can get an existing event", async function () {
      const tx = await betOracle.getEvent(events[1].id);
      expect(tx.id).to.equal(events[1].id);
      expect(tx.name).to.be.a("string").equal(events[1].name);
      expect(tx.participants).to.be.a("string").equal(events[1].teams);
      expect(tx.participantCount).to.be.a("number").equal(events[1].teamsCount);
      // chai-bignumber doesn't support the latest version of bignumber
      expect(tx.date).to.equal(events[1].date);
      expect(tx.kind).to.be.a("number").equal(events[1].kind);
      expect(tx.outcome).to.be.a("number").equal(EventOutcome.Pending);
      expect(tx.winner).to.be.a("number").equal(-1);
    });

    it("getEvent: can get a NON existing event", async function () {
      const nonExistingEventId = ethers.utils.solidityKeccak256(
        ["string", "uint8", "uint256"],
        ["Non existent event", 2, timeToBigNumber(DateTime.now())]
      );
      const tx = await betOracle.getEvent(nonExistingEventId);
      expect(tx.id).to.equal(nonExistingEventId);
      expect(tx.name).to.be.a("string").empty;
      expect(tx.participants).to.be.a("string").empty;
      expect(tx.participantCount).to.be.a("number").equal(0);
      // chai-bignumber doesn't support the latest version of bignumber
      expect(tx.date).to.equal(ethers.constants.Zero);
      expect(tx.kind).to.be.a("number").equal(0);
      expect(tx.outcome).to.be.a("number").equal(EventOutcome.Pending);
      expect(tx.winner).to.be.a("number").equal(-1);
    });

    it("eventExists(eventId) returns false when there is NO event with this id", async function () {
      const nonExistingEventId = ethers.utils.solidityKeccak256(
        ["string", "uint8", "uint256"],
        ["Non existent event", 2, timeToBigNumber(DateTime.now())]
      );
      expect(await betOracle.eventExists(nonExistingEventId)).to.be.false;
    });

    it("eventExists(eventId) returns true when there is an event with this id", async function () {
      expect(await betOracle.eventExists(events[2].id)).to.be.true;
    });

    describe("getLatestEvent", function () {
      it.skip("getLatestEvent(true) returns the most recent Pending event if one", async function () {
        const tx = await betOracle.getLatestEvent(true);
        // TODO:
      });
      it("getLatestEvent(false) returns the most recent (pending or Decided) event if one");
      it("getLatestEvent returns a specially crafted not found event when there is NO event");
    });

    it("getAllSportEvents");

    it("can getPendingEvents", () => new Promise(async (resolve0, reject0) => {
      const eventIds = await betOracle.getPendingEvents();
      const promises = [];
      for (let i = 0; i < eventIds.length; i++) {
        const evt = await betOracle.getEvent(eventIds[i]);
        const p = new Promise((resolve, reject) => {
          expect(evt.id).to.equal(eventIds[i]);
          resolve();
        });
        promises.push(p);
      }
      await Promise.all(promises);
      resolve0();
    }));
  });

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Declaring an Event Outcome
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  describe("Event Outcome", function () {
    it("declareOutcome");
  });

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // Helper Functions
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  describe("Helper functions", function() {
    it("getAddress() returns the address of this contract's instance", async function () {
      expect(await betOracle.getAddress()).to.be.equal(betOracle.address);
    });

    it("testConnection() always returns true", async function () {
      const isConnected = await betOracle.testConnection();
      expect(isConnected).to.be.true;
    });
  });
});
