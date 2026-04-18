import os
import sys


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line(["manage.py", "runserver", *sys.argv[1:]])


if __name__ == "__main__":
    main()
