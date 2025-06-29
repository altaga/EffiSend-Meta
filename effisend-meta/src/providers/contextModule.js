// Basic Imports
import React from "react";
import { baseWallets, blockchains } from "../core/constants";

const ContextModule = React.createContext();

// Context Provider Component

class ContextProvider extends React.Component {
  // define all the values you want to use in the context
  constructor(props) {
    super(props);
    this.state = {
      value: {
        wallets: baseWallets,
        balances: blockchains.map((x) => x.tokens.map(() => 0)),
        usdConversion: blockchains.map((x) => x.tokens.map(() => 0)),
        starter: false,
        isTransactionActive: false, // false
        transactionData: {
          // Wallet Selection
          walletSelector: 0,
          // Commands
          command: "transfer",
          chainSelected: 0,
          tokenSelected: 0,
          // Transaction
          transaction: {},
          // With Savings
          withSavings: false,
          transactionSavings: {},
          // Single Display
          label: "",
          to: "",
          amount: 0.0,
          tokenSymbol: blockchains[0].token,
          // Savings Display
          savedAmount: 0.0,
        },
      },
    };
  }

  setValue = (value, then = () => {}) => {
    this.setState(
      {
        value: {
          ...this.state.value,
          ...value,
        },
      },
      () => then()
    );
  };

  render() {
    const { children } = this.props;
    const { value } = this.state;
    // Fill this object with the methods you want to pass down to the context
    const { setValue } = this;

    return (
      <ContextModule.Provider
        // Provide all the methods and values defined above
        value={{
          value,
          setValue,
        }}
      >
        {children}
      </ContextModule.Provider>
    );
  }
}

// Dont Change anything below this line

export { ContextProvider };
export const ContextConsumer = ContextModule.Consumer;
export default ContextModule;
