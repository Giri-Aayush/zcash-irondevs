import time
from datetime import datetime, timezone
from pathlib import Path
from pydriller import Repository

def main():
  start_time = time.perf_counter()
  data = Path("../../data")
  commits = 0
  emails = set()
  start = datetime.max.replace(tzinfo=timezone.utc)
  end = datetime.min.replace(tzinfo=timezone.utc)

  for commit in Repository([str(repo) for repo in data.glob('./*/*.git') if repo.is_dir()]).traverse_commits():
    commits += 1

    start = commit.committer_date if commit.committer_date < start else start
    end = commit.committer_date if commit.committer_date > end else end
    
    emails.add(commit.author.email)
    emails.update([co_author.email for co_author in commit.co_authors])
    emails.add(commit.committer.email)

  end_time = time.perf_counter()
  print(f"Found {commits} commits by {len(emails)} developers from {start.date()} to {end.date()} in {end_time - start_time:.1f}s.")



if __name__ == "__main__":
  main()

