import unittest, sys
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'scripts'))
from model import fit_predict, features, analyze

class TemporalTests(unittest.TestCase):
    def test_features_do_not_read_target_or_future(self):
        logs=list(np.log1p(np.arange(1,121)*100)); before=features(logs,80)
        logs[80:]=[999999]*40
        self.assertEqual(before,features(logs,80))
    def test_constant_series_is_stable(self):
        prediction=fit_predict([1000]*100,6)
        np.testing.assert_allclose(prediction,[1000]*6,rtol=1e-8)
    def test_forecast_has_no_negative_or_nan_values(self):
        values=[2000+7*i+100*np.sin(2*np.pi*i/12) for i in range(120)]
        prediction=fit_predict(values,6)
        self.assertTrue(np.isfinite(prediction).all())
        self.assertTrue((prediction>=0).all())

if __name__=='__main__': unittest.main()
