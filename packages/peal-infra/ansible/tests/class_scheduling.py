"""How xdist hands the tests to its workers: a class's tests together, to
one worker, and every other test on its own. CI splits the suite between
jobs by the same scopes (`shard`)."""

from __future__ import annotations

from collections import Counter

from xdist.scheduler import LoadScopeScheduling


def scope(nodeid: str) -> str:
    """A test's class, or the test itself outside a class."""
    # A parameter's id may hold "::"; the class comes before it.
    path, *names = nodeid.split("[", 1)[0].split("::")
    return f"{path}::{names[0]}" if len(names) > 1 else nodeid


def shard(nodeids: list[str], index: int, total: int) -> set[str]:
    """The tests of shard `index` (from 1) of `total`: whole scopes, the
    largest first, each to the shard with the fewest tests so far, so a
    class's containers start in one job alone and the shards hold about as
    many tests. Every job collects the same tests, so they agree."""
    sizes = Counter(scope(nodeid) for nodeid in nodeids)
    counts = [0] * total
    owner: dict[str, int] = {}
    for name, size in sorted(sizes.items(), key=lambda item: (-item[1], item[0])):
        least = min(range(total), key=lambda number: (counts[number], number))
        owner[name] = least
        counts[least] += size
    return {nodeid for nodeid in nodeids if owner[scope(nodeid)] == index - 1}


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
        return scope(nodeid)
