import importlib.util
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('excelden', Path(__file__).resolve().parents[1] / 'scripts/excelden.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class ImportChecks(unittest.TestCase):
    def setUp(self):
        m.HATALAR.clear()

    def test_blank_is_unknown_and_real_zero_survives(self):
        self.assertIsNone(m.istatistik({k: None for k in m.SAYIM}, 'p'))
        values = m.istatistik({'PTS': 0, 'REB': 4}, 'p')
        self.assertEqual(values['PTS'], 0)
        self.assertIsNone(values['AST'])
        self.assertIsNone(m.bos_veya_tam('', 'mac'))
        m.bos_veya_tam(-1, 'mac')
        self.assertTrue(m.HATALAR)

    def test_snapshot_conflict_and_trade_direction(self):
        p = {'id': 'p', 'name': 'P', 'status': 'takasla-gitti', 'left': '2026-10-28'}
        teams = {'1': [p], '2': [{**p, 'status': 'kadroda'}]}
        tx = [{'type': 'takas', 'playerId': 'p', 'teamId': '1', 'otherTeamId': '2', 'date': '2026-10-28'}]
        m.kadro_tutarliligi(teams, [], tx)
        self.assertEqual(p['tradedTo'], '2')
        self.assertEqual(m.HATALAR, [])
        m.kadro_tutarliligi(teams, [{'id': 'p', 'name': 'P'}], tx)
        self.assertTrue(any('serbest listesinde olamaz' in e for e in m.HATALAR))

if __name__ == '__main__':
    unittest.main()
