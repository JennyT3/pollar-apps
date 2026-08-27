"""
Pasanaku digital - 02 QR contribution flow
Scan the round QR, land on /pay with amount and recipient prefilled, confirm
once, server records the hash.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _style import *
import graphviz

g = graphviz.Digraph("qr-contribution-flow")
g.attr(**base_graph_attr(
    rankdir="LR",
    splines="polyline",
    size="16,7",
    label=hl(
        "Pasanaku digital - QR contribution flow",
        "App URL QR (not SEP-7) · one confirmation · Horizon is the source of truth",
    ),
))
g.attr("node", **base_node_attr())
g.attr("edge", **base_edge_attr())

g.node("qr", hl("Round QR", "/c/{code}/pay", "Recipient + amount live on the page"),
       fillcolor=F_ACCENT, color=B_ACCENT, penwidth="2")
g.node("scan", hl("Member scans", "Phone camera / Pollar session", "No G-address typing"),
       fillcolor=F_CLIENT, color=B_CLIENT)
g.node("page", hl("Pay page", "GET /memo?payer=", "Hides the button if you are the recipient"),
       fillcolor=F_CLIENT, color=B_CLIENT)
g.node("tx", hl("runTx('payment')", "USDC + memo id", "Fails closed if balance is still XLM"),
       fillcolor=F_CLIENT, color=B_CLIENT, penwidth="2")
g.node("post", hl("POST /pay", "hash + payer address"),
       fillcolor=F_BACKEND, color=B_BACKEND)
g.node("hz", hl("Horizon gates", "from memo asset dest amount"),
       fillcolor=F_EXTERNAL, color=B_EXTERNAL)
g.node("dash", hl("Dashboard", "Pagó / Debe / Le toca", "History: time payer recipient hash"),
       fillcolor=F_SUCCESS, color=B_SUCCESS, penwidth="2")
g.node("reject", hl("Rejected", "XLM · path · self-pay · replay"),
       fillcolor=F_DANGER, color=B_DANGER)

g.edge("qr", "scan")
g.edge("scan", "page")
g.edge("page", "tx")
g.edge("tx", "post")
g.edge("post", "hz")
g.edge("hz", "dash", label="all gates pass", color=E_SUCCESS, fontcolor=B_SUCCESS)
g.edge("hz", "reject", label="any gate fails", color=E_DANGER, fontcolor=B_DANGER)

render(g, "02-qr-contribution-flow")
