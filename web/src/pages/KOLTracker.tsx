import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";

interface TrackedKOL {
  id: string;
  wallets: string[];
  name: string;
  image?: string;
  bio?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  alertOnBuy: boolean;
  alertOnSell: boolean;
}

interface KOLTransaction {
  timestamp: number;
  wallet: string;
  mint: string;
  tokenSymbol: string;
  type: "buy" | "sell";
  amount: number;
  price: number;
  totalValue: number;
}

export default function KOLTracker() {
  const [trackedKOLs, setTrackedKOLs] = useState<TrackedKOL[]>([]);
  const [selectedKOL, setSelectedKOL] = useState<TrackedKOL | null>(null);
  const [transactions, setTransactions] = useState<KOLTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [setupForm, setSetupForm] = useState({
    name: "",
    wallets: "",
    telegramBotToken: "",
    image: "",
    bio: "",
    alertOnBuy: true,
    alertOnSell: true,
  });

  // Load tracked KOLs from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("orbitx-kol-trackers");
    if (saved) {
      setTrackedKOLs(JSON.parse(saved));
    }
  }, []);

  const handleAddKOL = async () => {
    if (!setupForm.name || !setupForm.wallets) {
      alert("Name and at least one wallet required");
      return;
    }

    const newKOL: TrackedKOL = {
      id: Date.now().toString(),
      name: setupForm.name,
      wallets: setupForm.wallets.split(",").map((w) => w.trim()),
      telegramBotToken: setupForm.telegramBotToken,
      image: setupForm.image,
      bio: setupForm.bio,
      alertOnBuy: setupForm.alertOnBuy,
      alertOnSell: setupForm.alertOnSell,
    };

    const updated = [...trackedKOLs, newKOL];
    setTrackedKOLs(updated);
    localStorage.setItem("orbitx-kol-trackers", JSON.stringify(updated));

    // Reset form
    setSetupForm({
      name: "",
      wallets: "",
      telegramBotToken: "",
      image: "",
      bio: "",
      alertOnBuy: true,
      alertOnSell: true,
    });
    setShowSetup(false);
  };

  const handleLoadTransactions = async (kol: TrackedKOL) => {
    setSelectedKOL(kol);
    setLoading(true);

    try {
      // Fetch transactions from API for this KOL's wallets
      const txs = await Promise.all(
        kol.wallets.map((wallet) =>
          fetch(`/api/kol/transactions?wallet=${wallet}`).then((r) =>
            r.json()
          )
        )
      );

      const allTxs: KOLTransaction[] = txs
        .flat()
        .sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(allTxs.slice(0, 100)); // Last 100 transactions
    } catch (error) {
      console.error("Failed to load transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestAlert = async (kol: TrackedKOL) => {
    if (!kol.telegramBotToken) {
      alert("No Telegram bot token configured");
      return;
    }

    try {
      await fetch("/api/kol/test-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kolId: kol.id,
          botToken: kol.telegramBotToken,
        }),
      });
      alert("Test alert sent!");
    } catch (error) {
      alert("Failed to send test alert");
    }
  };

  const handleDeleteKOL = (id: string) => {
    const updated = trackedKOLs.filter((k) => k.id !== id);
    setTrackedKOLs(updated);
    localStorage.setItem("orbitx-kol-trackers", JSON.stringify(updated));
    if (selectedKOL?.id === id) {
      setSelectedKOL(null);
    }
  };

  return (
    <Layout>
      <div className="kol-tracker">
        <style>{`
          .kol-tracker {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            color: #fff;
          }
          .kol-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
          }
          .kol-header h1 {
            font-size: 32px;
            font-weight: 700;
            margin: 0;
          }
          .btn-add {
            background: linear-gradient(135deg, #FF6B35, #D94315);
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            color: #fff;
            font-weight: 600;
            cursor: pointer;
          }
          .btn-add:hover {
            opacity: 0.9;
          }
          .kol-content {
            display: grid;
            grid-template-columns: 300px 1fr;
            gap: 20px;
          }
          .kol-list {
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.1);
            padding: 15px;
            max-height: 600px;
            overflow-y: auto;
          }
          .kol-item {
            padding: 12px;
            margin-bottom: 10px;
            background: rgba(255,255,255,0.08);
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .kol-item:hover {
            background: rgba(255,255,255,0.12);
          }
          .kol-item.active {
            background: linear-gradient(135deg, rgba(255,107,53,0.3), rgba(217,67,21,0.3));
            border: 1px solid #FF6B35;
          }
          .kol-item-img {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #FF6B35, #D94315);
            flex-shrink: 0;
          }
          .kol-item-info {
            flex: 1;
          }
          .kol-item-name {
            font-weight: 600;
            font-size: 14px;
            margin: 0;
          }
          .kol-item-wallets {
            font-size: 12px;
            color: rgba(255,255,255,0.6);
            margin: 0;
          }
          .kol-detail {
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.1);
            padding: 20px;
          }
          .kol-detail-header {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
          }
          .kol-detail-img {
            width: 80px;
            height: 80px;
            border-radius: 8px;
            background: linear-gradient(135deg, #FF6B35, #D94315);
            flex-shrink: 0;
          }
          .kol-detail-info h2 {
            margin: 0 0 8px 0;
            font-size: 20px;
          }
          .kol-detail-bio {
            font-size: 13px;
            color: rgba(255,255,255,0.7);
            line-height: 1.4;
          }
          .kol-actions {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
          }
          .kol-actions button {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            padding: 8px 16px;
            border-radius: 6px;
            color: #fff;
            cursor: pointer;
            font-size: 13px;
          }
          .kol-actions button:hover {
            background: rgba(255,255,255,0.15);
          }
          .tx-list {
            max-height: 400px;
            overflow-y: auto;
          }
          .tx-item {
            padding: 12px;
            margin-bottom: 8px;
            background: rgba(255,255,255,0.05);
            border-radius: 6px;
            font-size: 13px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .tx-buy {
            border-left: 3px solid #00FF88;
          }
          .tx-sell {
            border-left: 3px solid #FF5555;
          }
          .setup-modal {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999;
          }
          .setup-form {
            background: #1a1a2e;
            padding: 30px;
            border-radius: 12px;
            width: 90%;
            max-width: 500px;
            border: 1px solid rgba(255,255,255,0.1);
          }
          .setup-form h2 {
            margin-top: 0;
          }
          .form-group {
            margin-bottom: 15px;
          }
          .form-group label {
            display: block;
            margin-bottom: 5px;
            font-size: 13px;
            color: rgba(255,255,255,0.8);
          }
          .form-group input,
          .form-group textarea {
            width: 100%;
            padding: 10px;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 6px;
            color: #fff;
            font-family: inherit;
            box-sizing: border-box;
          }
          .form-group input::placeholder {
            color: rgba(255,255,255,0.4);
          }
          .form-checkbox {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .form-checkbox input {
            width: auto;
          }
          .setup-actions {
            display: flex;
            gap: 10px;
          }
          .setup-actions button {
            flex: 1;
            padding: 10px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
          }
          .btn-save {
            background: linear-gradient(135deg, #FF6B35, #D94315);
            color: #fff;
          }
          .btn-cancel {
            background: rgba(255,255,255,0.1);
            color: #fff;
          }
        `}</style>

        {/* Header */}
        <div className="kol-header">
          <h1>KOL Tracker</h1>
          <button className="btn-add" onClick={() => setShowSetup(true)}>
            + Add KOL
          </button>
        </div>

        {/* Setup Modal */}
        {showSetup && (
          <div className="setup-modal" onClick={() => setShowSetup(false)}>
            <div
              className="setup-form"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>Setup KOL Tracker</h2>

              <div className="form-group">
                <label>KOL Name</label>
                <input
                  type="text"
                  placeholder="e.g., DeFi Guru"
                  value={setupForm.name}
                  onChange={(e) =>
                    setSetupForm({ ...setupForm, name: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Wallet Addresses (comma-separated)</label>
                <textarea
                  placeholder="wallet1,wallet2,wallet3"
                  rows={3}
                  value={setupForm.wallets}
                  onChange={(e) =>
                    setSetupForm({ ...setupForm, wallets: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Image URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={setupForm.image}
                  onChange={(e) =>
                    setSetupForm({ ...setupForm, image: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Bio</label>
                <textarea
                  placeholder="Short description"
                  rows={2}
                  value={setupForm.bio}
                  onChange={(e) =>
                    setSetupForm({ ...setupForm, bio: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>Telegram Bot Token</label>
                <input
                  type="password"
                  placeholder="123456789:ABCdefGHIjklmnoPQRstuvWXYZ"
                  value={setupForm.telegramBotToken}
                  onChange={(e) =>
                    setSetupForm({
                      ...setupForm,
                      telegramBotToken: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-checkbox">
                  <input
                    type="checkbox"
                    checked={setupForm.alertOnBuy}
                    onChange={(e) =>
                      setSetupForm({
                        ...setupForm,
                        alertOnBuy: e.target.checked,
                      })
                    }
                  />
                  Alert on buys
                </label>
              </div>

              <div className="form-group">
                <label className="form-checkbox">
                  <input
                    type="checkbox"
                    checked={setupForm.alertOnSell}
                    onChange={(e) =>
                      setSetupForm({
                        ...setupForm,
                        alertOnSell: e.target.checked,
                      })
                    }
                  />
                  Alert on sells
                </label>
              </div>

              <div className="setup-actions">
                <button className="btn-save" onClick={handleAddKOL}>
                  Save
                </button>
                <button
                  className="btn-cancel"
                  onClick={() => setShowSetup(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {trackedKOLs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.6)" }}>
              No KOLs tracked yet. Click "+ Add KOL" to get started!
            </p>
          </div>
        ) : (
          <div className="kol-content">
            {/* KOL List */}
            <div className="kol-list">
              <h3 style={{ marginTop: 0, marginBottom: 15 }}>Tracked KOLs</h3>
              {trackedKOLs.map((kol) => (
                <div
                  key={kol.id}
                  className={`kol-item ${
                    selectedKOL?.id === kol.id ? "active" : ""
                  }`}
                  onClick={() => handleLoadTransactions(kol)}
                >
                  {kol.image ? (
                    <img
                      src={kol.image}
                      alt={kol.name}
                      className="kol-item-img"
                    />
                  ) : (
                    <div className="kol-item-img" />
                  )}
                  <div className="kol-item-info">
                    <p className="kol-item-name">{kol.name}</p>
                    <p className="kol-item-wallets">
                      {kol.wallets.length} wallet(s)
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Detail View */}
            {selectedKOL ? (
              <div className="kol-detail">
                <div className="kol-detail-header">
                  {selectedKOL.image ? (
                    <img
                      src={selectedKOL.image}
                      alt={selectedKOL.name}
                      className="kol-detail-img"
                    />
                  ) : (
                    <div className="kol-detail-img" />
                  )}
                  <div style={{ flex: 1 }}>
                    <h2>{selectedKOL.name}</h2>
                    {selectedKOL.bio && (
                      <p className="kol-detail-bio">{selectedKOL.bio}</p>
                    )}
                    <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                      {selectedKOL.wallets.join(", ")}
                    </p>
                  </div>
                </div>

                <div className="kol-actions">
                  <button onClick={() => handleTestAlert(selectedKOL)}>
                    📱 Test Alert
                  </button>
                  <button
                    onClick={() => handleDeleteKOL(selectedKOL.id)}
                    style={{ color: "#FF5555" }}
                  >
                    🗑️ Delete
                  </button>
                </div>

                <h3 style={{ marginTop: 0, marginBottom: 15 }}>
                  Recent Transactions {loading && "..."}
                </h3>
                <div className="tx-list">
                  {transactions.length === 0 ? (
                    <p style={{ color: "rgba(255,255,255,0.5)" }}>
                      No transactions found
                    </p>
                  ) : (
                    transactions.map((tx, i) => (
                      <div
                        key={i}
                        className={`tx-item ${tx.type === "buy" ? "tx-buy" : "tx-sell"}`}
                      >
                        <div>
                          <strong>{tx.type.toUpperCase()}</strong> {tx.amount} ${tx.tokenSymbol}
                          <br />
                          <span style={{ color: "rgba(255,255,255,0.5)" }}>
                            ${tx.totalValue.toFixed(2)}
                          </span>
                        </div>
                        <div style={{ textAlign: "right", fontSize: "11px" }}>
                          {new Date(tx.timestamp * 1000).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div
                className="kol-detail"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}
              >
                <p style={{ color: "rgba(255,255,255,0.5)" }}>
                  Select a KOL to view details
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
