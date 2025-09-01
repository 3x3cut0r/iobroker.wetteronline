# run dev-server

dev-server run default
dev-server update
dev-server upload

# test

npm test

# release update

npm run release minor -- --dry
npm run release minor --

# search and replace mac

LC_ALL=C find . -type f -name *.json -exec sed -i '' 's/daytime0/0dt/g' {} \;
