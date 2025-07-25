start:
	python init_db.py && gunicorn app:app