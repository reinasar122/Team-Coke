import os
from unittest.mock import patch

from django.test import SimpleTestCase

from backend_coke_system.settings import _env_bool


class EnvironmentBooleanTests(SimpleTestCase):
    def test_unrelated_debug_value_uses_the_configured_default(self):
        with patch.dict(os.environ, {"DEBUG": "release"}):
            self.assertTrue(_env_bool("DEBUG", True))
            self.assertFalse(_env_bool("DEBUG", False))

    def test_explicit_production_debug_flag_is_preserved(self):
        with patch.dict(os.environ, {"DEBUG": "false"}):
            self.assertFalse(_env_bool("DEBUG", True))
