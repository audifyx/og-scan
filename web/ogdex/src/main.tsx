import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import Layout from "./components/Layout";
import Screener from "./pages/Screener";
import TokenDetail from "./pages/TokenDetail";
import Submit from "./pages/Submit";
import Store from "./pages/Store";
import Boost from "./pages/Boost";
import Wallet from "./pages/Wallet";
import WalletIndex from "./pages/WalletIndex";
import KolScanner from "./pages/KolScanner";
import KolProfile from "./pages/KolProfile";
import Admin from "./pages/Admin";
import Launch from "./pages/Launch";
import NewlyListed from "./pages/NewlyListed";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename="/OGDEX">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Screener />} />
          <Route path="token/:mint" element={<TokenDetail />} />
          <Route path="store" element={<Store />} />
          <Route path="submit" element={<Submit />} />
          <Route path="boost" element={<Boost />} />
          <Route path="launch" element={<Launch />} />
          <Route path="new" element={<NewlyListed />} />
          <Route path="wallet" element={<WalletIndex />} />
          <Route path="wallet/:address" element={<Wallet />} />
          <Route path="kol" element={<KolScanner />} />
          <Route path="kol/:address" element={<KolProfile />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
