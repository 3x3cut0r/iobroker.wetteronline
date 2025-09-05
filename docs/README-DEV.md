# run dev-server

The dev-server needs a profile. Run setup once to create the default profile and avoid "Profile default doesn't exist":

```bash
# setup
dev-server setup

# run
dev-server run

# upload after changes
dev-server upload

# update
dev-server update
```

# test

npm test

# release update

npm run release minor -- --dry
npm run release minor --

# search and replace mac

LC_ALL=C find . -type f -name *.json -exec sed -i '' 's/daytime0/0dt/g' {} \;
