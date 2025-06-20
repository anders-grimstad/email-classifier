# CLAUDE.md - Guidance for Email Classifier Project

## Commands
- Setup: `pip install -r requirements.txt`
- Lint: `flake8 . && black --check .`
- Format: `black .`
- Type check: `mypy .`
- Run tests: `pytest tests/`
- Run single test: `pytest tests/test_file.py::test_function -v`
- Run notebook: `jupyter notebook`

## Code Style Guidelines
- Python 3.8+ with type annotations
- Format with Black, lint with flake8
- Snake_case for variables and functions, PascalCase for classes
- Group imports: stdlib → third-party → local (alphabetical within groups)
- Doc-strings in Google style format
- Maximum line length: 88 characters
- Exception handling: specific exceptions, proper logging
- Model training config in YAML, data preprocessing in separate modules
- Tests should use pytest fixtures and follow AAA pattern