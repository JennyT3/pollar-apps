"""
Pasanaku digital - 06 Turn order
Join FIFO, organizer shuffle (Fisher-Yates) or manual reorder, then lock.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from _style import *
import graphviz

g = graphviz.Digraph("turn-order")
g.attr(**base_graph_attr(
    rankdir="TB",
    splines="spline",
    size="12,10",
    label=hl(
        "Pasanaku digital - Turn order",
        "Issue #4: members and their turn order, agreed manually or drawn by the app",
    ),
))
g.attr("node", **base_node_attr())
g.attr("edge", **base_edge_attr())

g.node("create", hl("Organizer creates", "First member · turn_index 0", "Cookie pasanaku_admin_{code}"),
       fillcolor=F_BACKEND, color=B_BACKEND)
g.node("join", hl("Others join", "QR or link + Pollar login", "FIFO turn_index"),
       fillcolor=F_CLIENT, color=B_CLIENT)
g.node("draw", hl("Sortear turnos", "Fisher-Yates on member ids"),
       fillcolor=F_ACCENT, color=B_ACCENT)
g.node("manual", hl("Subir / bajar", "Explicit address order"),
       fillcolor=F_ACCENT, color=B_ACCENT)
g.node("lock", hl("Lock", "First confirmed payment", "join + shuffle + reorder reject"),
       fillcolor=F_DECISION, color=B_DECISION, penwidth="2.5")
g.node("run", hl("Rounds follow turn_index", "Recipient = members[current_round - 1]"),
       fillcolor=F_SUCCESS, color=B_SUCCESS)

g.edge("create", "join")
g.edge("join", "draw")
g.edge("join", "manual")
g.edge("draw", "lock")
g.edge("manual", "lock")
g.edge("lock", "run", color=E_SUCCESS)

render(g, "06-turn-order")
