"""
Pasanaku digital - 03 Circle state machine
open -> active -> completed. Join and shuffle only while open.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _style import *
import graphviz

g = graphviz.Digraph("state-machine")
g.attr(**base_graph_attr(
    rankdir="TB",
    splines="spline",
    size="11,12",
    label=hl(
        "Pasanaku digital - Circle state machine",
        "Join and turn order freeze on the first confirmed payment",
    ),
))
g.attr("node", **base_node_attr(shape="box", style="filled,rounded"))
g.attr("edge", **base_edge_attr())

g.node("__start__", "",
       shape="circle", style="filled", fillcolor=T_DARK, color=T_DARK,
       width="0.3", height="0.3", fixedsize="true")
g.node("__end__", "",
       shape="doublecircle", style="filled", fillcolor=T_DARK, color=T_DARK,
       width="0.3", height="0.3", fixedsize="true")

g.node("open",
       hl("OPEN", "Members join via link or QR", "Organizer shuffles or reorders"),
       fillcolor=F_ACCENT, color=B_ACCENT, penwidth="2")
g.node("active",
       hl("ACTIVE", "current_round 1..N", "Join locked · turns frozen"),
       fillcolor=F_BACKEND, color=B_BACKEND, penwidth="2.5")
g.node("round",
       hl("ROUND k", "Recipient = member[k-1]", "N-1 others pay USDC to that account"),
       fillcolor=F_CLIENT, color=B_CLIENT)
g.node("completed",
       hl("COMPLETED", "Every member has collected once", "Dashboard: círculo cerrado · nobody is 'Le toca'"),
       fillcolor=F_SUCCESS, color=B_SUCCESS, penwidth="3")

g.edge("__start__", "open", label="organizer creates circle")
g.edge("open", "active", label="first payment confirmed", color=E_SUCCESS)
g.edge("active", "round", label="open current round")
g.edge("round", "round", label="N-1 payers in · advance k")
g.edge("round", "completed",
       label="last round fully paid",
       color=E_SUCCESS, fontcolor=B_SUCCESS, penwidth="2")
g.edge("completed", "__end__", style="invis")

render(g, "03-circle-state-machine")
