import unittest,sys,copy
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import county_model as model
class CountyModelTests(unittest.TestCase):
 def test_future_administrative_values_cannot_change_a_past_forecast(self):
  p=model.read('counties')['programs'][0];current=model.read('census');old=model.read('census-history');origin=len(p['snapshots'])-8
  before,info=model.predict(p,origin,current,old)
  modified=copy.deepcopy(p)
  for snapshot in modified['snapshots'][origin+1:]:
   for c in snapshot['values']:c['value']*=17
  after,_=model.predict(modified,origin,current,old)
  self.assertEqual(before,after);self.assertLessEqual(info['trainingLastTarget'],p['snapshots'][origin]['date'])
 def test_census_release_selection_and_training_only_standardization(self):
  current=model.read('census');old=model.read('census-history')
  self.assertEqual(model.vintage('2025-12',current,old)['year'],2019)
  self.assertEqual(model.vintage('2026-03',current,old)['year'],2024)
  mean,scale,beta=model.fit([[1,5],[2,5],[3,5]],[1,2,3])
  np.testing.assert_array_equal(mean,[2,5]);self.assertEqual(scale[1],1);self.assertTrue(np.isfinite(beta).all())
if __name__=='__main__':unittest.main()
