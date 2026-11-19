"""How CI splits the suite between its jobs (class_scheduling.shard)."""

from __future__ import annotations

from class_scheduling import scope, shard

NODEIDS = [
    "tests/test_a.py::TestStack::test_one",
    "tests/test_a.py::TestStack::test_two[x::y]",
    "tests/test_a.py::TestStack::test_three",
    "tests/test_a.py::test_alone",
    "tests/test_b.py::test_first",
    "tests/test_b.py::test_second[1]",
]


def test_a_class_is_one_scope_whatever_its_parameters_hold():
    assert scope("tests/test_a.py::TestStack::test_two[x::y]") == "tests/test_a.py::TestStack"
    assert scope("tests/test_b.py::test_second[1]") == "tests/test_b.py::test_second[1]"


def test_the_shards_hold_every_test_once():
    shards = [shard(NODEIDS, index, 2) for index in (1, 2)]
    assert shards[0] | shards[1] == set(NODEIDS)
    assert shards[0].isdisjoint(shards[1])


def test_a_class_stays_in_one_shard():
    stack = {nodeid for nodeid in NODEIDS if "::TestStack::" in nodeid}
    assert any(stack <= shard(NODEIDS, index, 2) for index in (1, 2))


def test_the_shards_hold_about_as_many_tests():
    sizes = sorted(len(shard(NODEIDS, index, 2)) for index in (1, 2))
    assert sizes == [3, 3]


def test_one_shard_is_the_whole_suite():
    assert shard(NODEIDS, 1, 1) == set(NODEIDS)
