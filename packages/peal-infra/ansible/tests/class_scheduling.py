"""How xdist hands the tests to its workers: a class's tests together, to
one worker, and every other test on its own."""

from __future__ import annotations

from xdist.scheduler import LoadScopeScheduling


class ClassScheduling(LoadScopeScheduling):
    """xdist's scheduling by scope, a scope being a test's class, or the
    test itself outside a class. Tests that share a module's containers
    are written as one class, so the worker that runs them starts the
    containers once; the others never do. xdist hands the scopes with the
    most tests out first, so a class never starts after the rest is done.

    xdist_group would say the same, but xdist 3.8.0 groups no more with
    pytest 9.2, which ignores the node ids it rewrites (pytest-xdist
    #1386, fixed in its main branch, not released yet)."""

    def _split_scope(self, nodeid: str) -> str:
        # A parameter's id may hold "::"; the class comes before it.
        path, *names = nodeid.split("[", 1)[0].split("::")
        return f"{path}::{names[0]}" if len(names) > 1 else nodeid
