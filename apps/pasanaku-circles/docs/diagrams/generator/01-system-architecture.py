"""
Pasanaku digital - 01 System Architecture
Browser (Pollar SDK + QR UI) talks to the Next.js app. The API verifies
payments against Horizon and stores circle state in libSQL/Turso.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _style import *
import graphviz

g = graphviz.Digraph("system-architecture")
g.attr(**base_graph_attr(
    rankdir="TB",
    splines="spline",
    size="14,10",
    label=hl(
        "Pasanaku digital - System Architecture",
        "Direct USDC pay to the member whose turn it is · server verifies on Horizon",
    ),
))
g.attr("node", **base_node_attr())
g.attr("edge", **base_edge_attr())

with g.subgraph(name="cluster_browser") as b:
    b.attr(
        label=hl("Browser  -  Pollar session"),
        style="rounded",
        color=B_CLIENT,
        fontcolor=B_CLIENT,
        fontname=FONT,
        fontsize="12",
        penwidth="2.5",
        margin="18",
    )
    b.node("ui", hl("Circle UI", "Create · join · dashboard · QR", "Regional name: pasanaku / tanda / pandero"),
           fillcolor=F_CLIENT, color=B_CLIENT)
    b.node("pay", hl("ContributeButton", "runTx('payment') + memo id", "Waits for USDC · never falls back to XLM"),
           fillcolor=F_CLIENT, color=B_CLIENT, penwidth="2.5")
    b.node("sdk", hl("Pollar SDK", "@pollar/react ^0.11.2", "Auth · balance · one account across apps"),
           fillcolor=F_CLIENT, color=B_CLIENT)

with g.subgraph(name="cluster_api") as a:
    a.attr(
        label=hl("Next.js app  -  apps/pasanaku-circles"),
        style="rounded",
        color=B_BACKEND,
        fontcolor=B_BACKEND,
        fontname=FONT,
        fontsize="12",
        penwidth="2.5",
        margin="18",
    )
    a.node("routes", hl("Route handlers", "POST /circles · /join · /pay · /turns", "Cookie admin per circle code"),
           fillcolor=F_BACKEND, color=B_BACKEND)
    a.node("verify", hl("confirmPayment()", "16 on-chain gates", "from · memo · USDC issuer · no self-pay"),
           fillcolor=F_BACKEND, color=B_BACKEND, penwidth="2.5")
    a.node("db", hl("libSQL / Turso", "circles · members · payments", "Local file store · Vercel uses TURSO_*"),
           fillcolor=F_BACKEND, color=B_BACKEND)

with g.subgraph(name="cluster_net") as n:
    n.attr(
        label=hl("Stellar testnet"),
        style="rounded",
        color=B_EXTERNAL,
        fontcolor=B_EXTERNAL,
        fontname=FONT,
        fontsize="12",
        penwidth="2.5",
        margin="18",
    )
    n.node("horizon", hl("Horizon", "transactions/{hash}", "operations · from · asset · memo"),
           fillcolor=F_EXTERNAL, color=B_EXTERNAL)
    n.node("ledger", hl("Stellar ledger", "USDC payment + XLM fee", "Circle testnet issuer"),
           fillcolor=F_EXTERNAL, color=B_EXTERNAL, shape="cylinder", penwidth="2")

g.edge("ui", "sdk", label="login / balance")
g.edge("pay", "sdk", label="runTx payment")
g.edge("ui", "routes", label="create join shuffle")
g.edge("pay", "routes", label="POST hash + payer", penwidth="2")
g.edge("routes", "verify")
g.edge("verify", "horizon", label="fetchPayment", penwidth="2")
g.edge("verify", "db", label="insert if all gates pass")
g.edge("sdk", "ledger", label="submit tx")
g.edge("horizon", "ledger")

render(g, "01-system-architecture")
