import { useEffect, useState } from "react";

interface TrackedKOL {
  id: string;
  wallets: string[];
  name: string;
  image?: string;
  bio?: string;
  telegramBotToken?: string;
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

export default function KOLTelebot() {
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
      const txs = await Promise.all(
        kol.wallets.map((wallet) =>
          fetch(`/api/kol/transactions?wallet=${wallet}`).then((r) =>
            r.json()
          )
        )
      );

      const allTxs = txs
        .flat()
        .sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(allTxs.slice(0, 100));
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
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>KOL Telegram Bot Tracker</h1>
        <button style={styles.btnAdd} onClick={() => setShowSetup(true)}>
          + Add KOL
        </button>
      </div>

      {showSetup && (
        <div style={styles.modal} onClick={() => setShowSetup(false)}>
          <div style={styles.form} onClick={(e) => e.stopPropagation()}>
            <h2>Setup KOL Tracker</h2>

            <div style={styles.formGroup}>
              <label>KOL Name</label>
              <input
                type="text"
                placeholder="e.g., DeFi Guru"
                value={setupForm.name}
                onChange={(e) =>
                  setSetupForm({ ...setupForm, name: e.target.value })
                }
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label>Wallet Addresses (comma-separated)</label>
              <textarea
                placeholder="wallet1,wallet2,wallet3"
                rows={3}
                value={setupForm.wallets}
                onChange={(e) =>
                  setSetupForm({ ...setupForm, wallets: e.target.value })
                }
                style={styles.textarea}
              />
            </div>

            <div style={styles.formGroup}>
              <label>Image URL</label>
              <input
                type="url"
                placeholder="https://..."
                value={setupForm.image}
                onChange={(e) =>
                  setSetupForm({ ...setupForm, image: e.target.value })
                }
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label>Bio</label>
              <textarea
                placeholder="Short description"
                rows={2}
                value={setupForm.bio}
                onChange={(e) =>
                  setSetupForm({ ...setupForm, bio: e.target.value })
                }
                style={styles.textarea}
              />
            </div>

            <div style={styles.formGroup}>
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
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.checkbox}>
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

            <div style={styles.formGroup}>
              <label style={styles.checkbox}>
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

            <div style={styles.actions}>
              <button style={styles.btnSave} onClick={handleAddKOL}>
                Save
              </button>
              <button style={styles.btnCancel} onClick={() => setShowSetup(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {trackedKOLs.length === 0 ? (
        <div style={styles.empty}>
          <p>No KOLs tracked yet. Click "+ Add KOL" to get started!</p>
        </div>
      ) : (
        <div style={styles.content}>
          <div style={styles.list}>
            <h3>Tracked KOLs</h3>
            {trackedKOLs.map((kol) => (
              <div
                key={kol.id}
                style={{
                  ...styles.item,
                  ...(selectedKOL?.id === kol.id ? styles.itemActive : {}),
                }}
                onClick={() => handleLoadTransactions(kol)}
              >
                {kol.image ? (
                  <img src={kol.image} alt={kol.name} style={styles.itemImg} />
                ) : (
                  <div style={styles.itemImg} />
                )}
                <div style={styles.itemInfo}>
                  <p style={styles.itemName}>{kol.name}</p>
                  <p style={styles.itemWallets}>{kol.wallets.length} wallet(s)</p>
                </div>
              </div>
            ))}
          </div>

          {selectedKOL ? (
            <div style={styles.detail}>
              <div style={styles.detailHeader}>
                {selectedKOL.image ? (
                  <img src={selectedKOL.image} alt={selectedKOL.name} style={styles.detailImg} />
                ) : (
                  <div style={styles.detailImg} />
                )}
                <div style={styles.detailInfo}>
                  <h2>{selectedKOL.name}</h2>
                  {selectedKOL.bio && <p style={styles.bio}>{selectedKOL.bio}</p>}
                  <p style={styles.wallets}>{selectedKOL.wallets.join(", ")}</p>
                </div>
              </div>

              <div style={styles.detailActions}>
                <button style={styles.btnTest} onClick={() => handleTestAlert(selectedKOL)}>
                  📱 Test Alert
                </button>
                <button
                  style={styles.btnDelete}
                  onClick={() => handleDeleteKOL(selectedKOL.id)}
                >
                  🗑️ Delete
                </button>
              </div>

              <h3>Recent Transactions {loading && "..."}</h3>
              <div style={styles.txList}>
                {transactions.length === 0 ? (
                  <p style={styles.empty}>No transactions found</p>
                ) : (
                  transactions.map((tx, i) => (
                    <div
                      key={i}
                      style={{
                        ...styles.txItem,
                        ...(tx.type === "buy" ? styles.txBuy : styles.txSell),
                      }}
                    >
                      <div>
                        <strong>{tx.type.toUpperCase()}</strong> {tx.amount} ${tx.tokenSymbol}
                        <br />
                        <span style={styles.txValue}>${tx.totalValue.toFixed(2)}</span>
                      </div>
                      <div style={styles.txTime}>
                        {new Date(tx.timestamp * 1000).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div style={styles.detailEmpty}>
              <p>Select a KOL to view details</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "1400px" as const,
    margin: "0 auto" as const,
    padding: "20px" as const,
    color: "#fff" as const,
    fontFamily: "Inter, sans-serif" as const,
  },
  header: {
    display: "flex" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: "30px" as const,
  },
  title: {
    fontSize: "32px" as const,
    fontWeight: "700" as const,
    margin: "0" as const,
  },
  btnAdd: {
    background: "linear-gradient(135deg, #FF6B35, #D94315)" as const,
    border: "none" as const,
    padding: "10px 20px" as const,
    borderRadius: "8px" as const,
    color: "#fff" as const,
    fontWeight: "600" as const,
    cursor: "pointer" as const,
  },
  content: {
    display: "grid" as const,
    gridTemplateColumns: "300px 1fr" as const,
    gap: "20px" as const,
  },
  list: {
    background: "rgba(255,255,255,0.05)" as const,
    border: "1px solid rgba(255,255,255,0.1)" as const,
    borderRadius: "12px" as const,
    padding: "15px" as const,
    maxHeight: "600px" as const,
    overflowY: "auto" as const,
  },
  item: {
    padding: "12px" as const,
    marginBottom: "10px" as const,
    background: "rgba(255,255,255,0.08)" as const,
    borderRadius: "8px" as const,
    cursor: "pointer" as const,
    display: "flex" as const,
    alignItems: "center" as const,
    gap: "10px" as const,
    transition: "all 0.2s" as const,
  },
  itemActive: {
    background: "rgba(255,107,53,0.3)" as const,
    border: "1px solid #FF6B35" as const,
  },
  itemImg: {
    width: "40px" as const,
    height: "40px" as const,
    borderRadius: "50%" as const,
    background: "linear-gradient(135deg, #FF6B35, #D94315)" as const,
    flexShrink: 0 as const,
  },
  itemInfo: {
    flex: 1 as const,
  },
  itemName: {
    fontWeight: "600" as const,
    fontSize: "14px" as const,
    margin: "0" as const,
  },
  itemWallets: {
    fontSize: "12px" as const,
    color: "rgba(255,255,255,0.6)" as const,
    margin: "0" as const,
  },
  detail: {
    background: "rgba(255,255,255,0.05)" as const,
    border: "1px solid rgba(255,255,255,0.1)" as const,
    borderRadius: "12px" as const,
    padding: "20px" as const,
  },
  detailHeader: {
    display: "flex" as const,
    gap: "15px" as const,
    marginBottom: "20px" as const,
    paddingBottom: "20px" as const,
    borderBottom: "1px solid rgba(255,255,255,0.1)" as const,
  },
  detailImg: {
    width: "80px" as const,
    height: "80px" as const,
    borderRadius: "8px" as const,
    background: "linear-gradient(135deg, #FF6B35, #D94315)" as const,
    flexShrink: 0 as const,
  },
  detailInfo: {
    flex: 1 as const,
  },
  bio: {
    fontSize: "13px" as const,
    color: "rgba(255,255,255,0.7)" as const,
    lineHeight: "1.4" as const,
    margin: "8px 0 0 0" as const,
  },
  wallets: {
    fontSize: "12px" as const,
    color: "rgba(255,255,255,0.5)" as const,
    margin: "8px 0 0 0" as const,
  },
  detailActions: {
    display: "flex" as const,
    gap: "10px" as const,
    marginBottom: "20px" as const,
  },
  btnTest: {
    background: "rgba(255,255,255,0.1)" as const,
    border: "1px solid rgba(255,255,255,0.2)" as const,
    padding: "8px 16px" as const,
    borderRadius: "6px" as const,
    color: "#fff" as const,
    cursor: "pointer" as const,
    fontSize: "13px" as const,
  },
  btnDelete: {
    background: "rgba(255,255,255,0.1)" as const,
    border: "1px solid rgba(255,255,255,0.2)" as const,
    padding: "8px 16px" as const,
    borderRadius: "6px" as const,
    color: "#FF5555" as const,
    cursor: "pointer" as const,
    fontSize: "13px" as const,
  },
  txList: {
    maxHeight: "400px" as const,
    overflowY: "auto" as const,
  },
  txItem: {
    padding: "12px" as const,
    marginBottom: "8px" as const,
    background: "rgba(255,255,255,0.05)" as const,
    borderRadius: "6px" as const,
    fontSize: "13px" as const,
    display: "flex" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  txBuy: {
    borderLeft: "3px solid #00FF88" as const,
  },
  txSell: {
    borderLeft: "3px solid #FF5555" as const,
  },
  txValue: {
    color: "rgba(255,255,255,0.5)" as const,
  },
  txTime: {
    textAlign: "right" as const,
    fontSize: "11px" as const,
  },
  modal: {
    position: "fixed" as const,
    inset: 0 as const,
    background: "rgba(0,0,0,0.7)" as const,
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    zIndex: 999 as const,
  },
  form: {
    background: "#1a1a2e" as const,
    padding: "30px" as const,
    borderRadius: "12px" as const,
    width: "90%" as const,
    maxWidth: "500px" as const,
    border: "1px solid rgba(255,255,255,0.1)" as const,
  },
  formGroup: {
    marginBottom: "15px" as const,
  },
  input: {
    width: "100%" as const,
    padding: "10px" as const,
    background: "rgba(255,255,255,0.08)" as const,
    border: "1px solid rgba(255,255,255,0.1)" as const,
    borderRadius: "6px" as const,
    color: "#fff" as const,
    fontFamily: "inherit" as const,
    boxSizing: "border-box" as const,
  },
  textarea: {
    width: "100%" as const,
    padding: "10px" as const,
    background: "rgba(255,255,255,0.08)" as const,
    border: "1px solid rgba(255,255,255,0.1)" as const,
    borderRadius: "6px" as const,
    color: "#fff" as const,
    fontFamily: "inherit" as const,
    boxSizing: "border-box" as const,
  },
  checkbox: {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: "8px" as const,
  },
  actions: {
    display: "flex" as const,
    gap: "10px" as const,
  },
  btnSave: {
    flex: 1 as const,
    padding: "10px" as const,
    border: "none" as const,
    borderRadius: "6px" as const,
    background: "linear-gradient(135deg, #FF6B35, #D94315)" as const,
    color: "#fff" as const,
    fontWeight: "600" as const,
    cursor: "pointer" as const,
  },
  btnCancel: {
    flex: 1 as const,
    padding: "10px" as const,
    border: "none" as const,
    borderRadius: "6px" as const,
    background: "rgba(255,255,255,0.1)" as const,
    color: "#fff" as const,
    cursor: "pointer" as const,
  },
  empty: {
    textAlign: "center" as const,
    padding: "60px 20px" as const,
    color: "rgba(255,255,255,0.6)" as const,
  },
  detailEmpty: {
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    minHeight: "400px" as const,
    color: "rgba(255,255,255,0.5)" as const,
  },
};
