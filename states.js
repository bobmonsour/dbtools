import inquirer from "inquirer";

// Define the states of the application and the transitions between them
export const states = {
  selectingType: {
    action: function () {
      return selectType();
    },
    nextStates: {
      post: "enteringPost",
      site: "enteringSite",
      release: "enteringRelease",
      starter: "enteringStarter",
    },
  },
  enteringPost: {
    action: function () {
      return enterPost();
    },
    nextStates: { next: "whatNext" },
  },
  enteringSite: {
    action: function () {
      return enterSite();
    },
    nextStates: ["whatNext"],
  },
  enteringRelease: {
    action: function () {
      return enterRelease();
    },
    nextStates: ["whatNext"],
  },
  enteringStarter: {
    action: function () {
      return enterStarter();
    },
    nextStates: ["whatNext"],
  },
  whatNext: {
    action: function () {
      return whatNext();
    },
    nextStates: ["exiting"],
  },
  exiting: {
    action: function () {
      return exit();
    },
    nextStates: ["exiting"],
  },
};

const selectType = async () => {
  const questions = [
    {
      type: "rawlist",
      name: "entryType",
      message: "Type of entry:",
      choices: [
        { name: "post", value: "post" },
        { name: "site", value: "site" },
        { name: "release", value: "release" },
        { name: "starter", value: "starter" },
      ],
    },
  ];
  const answers = await inquirer.prompt(questions);
  return (result.next = answers.entryType);
};

const enterPost = () => {
  console.log("enterPost is here!");
  return (result.next = "whatNext");
};
const enterSite = () => {
  console.log("enterSite is here!");
  return (result.next = "whatNext");
};
const enterRelease = () => {
  console.log("enterRelease is here!");
  return (result.next = "whatNext");
};
const enterStarter = () => {
  console.log("enterStarter is here!");
  return (result.next = "whatNext");
};
const whatNext = () => {
  console.log("whatNext is here!");
  return (result.next = "selectingType");
};
const exit = () => {
  console.log("exit is here!");
  return (result.next = "exiting");
};

let currentState = states.selectingType;
let result = {
  next: "",
  exit: false,
};

let count = 0;
const main = async () => {
  while (count < 3) {
    // while (!result.exit) {
    try {
      console.log("currentState: ", currentState);
      console.log("currentState.action: ", currentState.action);
      await currentState.action();
      console.log("result.next: ", result.next);
      console.log(
        "currentState.nextStates[result.next]: ",
        currentState.nextStates[result.next]
      );
      if (currentState.nextStates[result.next]) {
        currentState = currentState.nextStates[result.next];
        console.log("currentState: ", currentState);
      } else {
        console.log(`There is no such ${nextState} for this ${currentState}!`);
      }
    } catch (error) {
      console.error(`Action ${currentState.action} is not a function`);
    }
    count++;
  }
};

main();
