// Buffer polyfill — must be before any @btc-vision imports
import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;
(window as any).global = window;

import React from 'react'
import ReactDOM from 'react-dom/client'
import { WalletConnectProvider } from '@btc-vision/walletconnect'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletConnectProvider theme="dark">
      <App />
    </WalletConnectProvider>
  </React.StrictMode>,
)
