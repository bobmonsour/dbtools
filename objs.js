// Just a test to see how to access this object
// Define the states of the application and the transitions between them
export const states = {
  selectingType: {
    action: function () {
      return selectType();
    },
    nextStates: ["enteringBlogPost"],
  },
  enteringBlogPost: {
    action: function () {
      return enterBlogPost();
    },
    nextStates: ["enteringSite"],
  },
};

const selectType = () => {
  console.log("selectType is here!");
};
const enterBlogPost = () => {
  console.log("enterBlogPost is here!");
};

// console.log(typeof states.selectingType.nextStates[0]);
const currentState = states.selectingType;
// console.log(currentState);
// console.log(currentState.nextStates);
const nextState = currentState.nextStates[0];
// console.log(nextState);
// console.log(states[nextState].action);
const result1 = currentState.action();
const result2 = states[nextState].action();
