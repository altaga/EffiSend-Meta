import { CameraView } from "expo-camera";
import React, { Component, createRef } from "react";

export default class CamQR extends Component {
  constructor(props) {
    super(props);
    this.state = {
      scanning: true,
    };
    this.data = createRef(null);
  }

  handleBarcodeScanned = (result) => {
    let temp = result.data;
    if (
      temp.length === 42 ||
      (temp.indexOf("ethereum:") > -1 && this.state.scanning)
    ) {
      this.data.current = temp;
      this.setState({ scanning: false });
    }
  };

  render() {
    return (
      <React.Fragment>
        <CameraView
          facing={this.props.facing}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          onBarcodeScanned={this.handleBarcodeScanned}
          style={{ height: "100%", width: "100%" }}
        />
      </React.Fragment>
    );
  }
}
