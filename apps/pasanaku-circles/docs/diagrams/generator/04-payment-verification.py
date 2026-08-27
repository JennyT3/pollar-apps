"""
Pasanaku digital - 04 Payment verification gates
The 16 checks confirmPayment runs before writing a row. Red edges reject.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _style import *
import graphviz

g = graphviz.Digraph("payment-verification")
g.attr(**base_graph_attr(
    rankdir="TB",
    splines="spline",
    size="12,16",
    label=hl(
        "Pasanaku digital - Payment verification",
        "10 XLM is not 10 USDC · hash replay is not a payment · recipient cannot self-pay",
    ),
))
g.attr("node", **base_node_attr())
g.attr("edge", **base_edge_attr())

g.node("post", hl("POST /pay", "hash + payer"), fillcolor=F_CLIENT, color=B_CLIENT)
g.node("member", hl("payer is a member", "G-address checksum-shaped"), fillcolor=F_DECISION, color=B_DECISION)
g.node("self", hl("payer !== recipient"), fillcolor=F_DECISION, color=B_DECISION)
g.node("hz", hl("Horizon tx successful"), fillcolor=F_EXTERNAL, color=B_EXTERNAL)
g.node("ops", hl("exactly 1 payment op", "reject path_payment_*"), fillcolor=F_DECISION, color=B_DECISION)
g.node("from", hl("op.from === payer"), fillcolor=F_DECISION, color=B_DECISION)
g.node("to", hl("op.to === recipient"), fillcolor=F_DECISION, color=B_DECISION)
g.node("amt", hl("stroops(amount) match"), fillcolor=F_DECISION, color=B_DECISION)
g.node("asset", hl("USDC + Circle issuer", "reject native XLM"), fillcolor=F_DECISION, color=B_DECISION, penwidth="2.5")
g.node("memo", hl("memo type id required", "equals memoIdFor(circle, round, payer)"), fillcolor=F_DECISION, color=B_DECISION)
g.node("uniq", hl("tx_hash unique", "payer unique per round"), fillcolor=F_DECISION, color=B_DECISION)
g.node("ok", hl("Insert payment", "maybe advance round / complete"), fillcolor=F_SUCCESS, color=B_SUCCESS, penwidth="2.5")
g.node("no", hl("400 · no write"), fillcolor=F_DANGER, color=B_DANGER, penwidth="2")

g.edge("post", "member")
g.edge("member", "self")
g.edge("self", "hz")
g.edge("hz", "ops")
g.edge("ops", "from")
g.edge("from", "to")
g.edge("to", "amt")
g.edge("amt", "asset")
g.edge("asset", "memo")
g.edge("memo", "uniq")
g.edge("uniq", "ok", color=E_SUCCESS, fontcolor=B_SUCCESS)

for src in ("member", "self", "hz", "ops", "from", "to", "amt", "asset", "memo", "uniq"):
    g.edge(src, "no", style="dashed", color=E_DANGER, fontcolor=B_DANGER)

render(g, "04-payment-verification")
