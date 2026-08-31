"""
Pasanaku digital - 05 Round lifecycle
Round k: every member except the recipient pays a fixed USDC amount to that
Pollar account. Pot = (N-1) * amount.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _style import *
import graphviz

g = graphviz.Digraph("round-lifecycle")
g.attr(**base_graph_attr(
    rankdir="LR",
    splines="spline",
    size="14,8",
    label=hl(
        "Pasanaku digital - Round lifecycle",
        "No escrow · each contribution is a real USDC payment to the current recipient",
    ),
))
g.attr("node", **base_node_attr())
g.attr("edge", **base_edge_attr())

g.node("m1", hl("Member 1", "turn 0 · ronda 1 cobra"), fillcolor=F_SUCCESS, color=B_SUCCESS)
g.node("m2", hl("Member 2", "paga ronda 1"), fillcolor=F_CLIENT, color=B_CLIENT)
g.node("m3", hl("Member 3", "paga ronda 1"), fillcolor=F_CLIENT, color=B_CLIENT)
g.node("pot", hl("Pollar balance of member 1", "(N-1) x amount USDC", "Visible in the wallet card"),
       fillcolor=F_ACCENT, color=B_ACCENT, penwidth="2.5")
g.node("hist", hl("History row", "timestamp · payer · recipient · amount · hash · round"),
       fillcolor=F_BACKEND, color=B_BACKEND)

g.edge("m2", "pot", label="USDC + memo id", color=E_SUCCESS)
g.edge("m3", "pot", label="USDC + memo id", color=E_SUCCESS)
g.edge("m1", "pot", label="does not pay this round", style="dashed", color=E_WARNING, fontcolor=B_DECISION)
g.edge("pot", "hist", label="each confirmPayment")

render(g, "05-round-lifecycle")
