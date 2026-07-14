#!/bin/bash

while read REPO; do
  SOURCE="https://github.com/$REPO.git"
  TARGET="./data/$REPO.git"

  if [ ! -d $TARGET ]; then
    echo "Cloning $SOURCE in $TARGET..."
    git clone --bare $SOURCE $TARGET
  else
    echo "Target $TARGET already exists, skip."
  fi
done < repositories.dat

