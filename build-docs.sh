# Build docs for the project
# Usage: ./build-docs.sh docs dist

export DOCS_DIR=$1
export DIST_DIR=$2

mkdir -p "$DIST_DIR"
mkdir -p "$DIST_DIR/docs"
cp -r "$DOCS_DIR/"* "$DIST_DIR/docs/"
cd "$DIST_DIR/docs"

# for each markdown file in the docs directory
# 1. Create a directory with the same name as the markdown file
# 2. Copy any referenced images to the output directory
# 3. Convert the markdown file to html
# 4. Remove the original markdown file
for file in ./*.md; do
    # 1.
    mkdir -p "${file%.md}"
    
    # 2.
    grep -o '!\[.*\]([^)]*\.png)' "$file" | sed 's/.*(\(.*\))/\1/' | while read img; do
        if [ -f "./$img" ]; then
            mv "./$img" "${file%.md}/"
        fi
    done
    
    # 3.
    pandoc -s "$file" --from markdown --to html5 --standalone \
        --embed-resources --mathjax --css=style.css \
        -o "${file%.md}/index.html"
    
    # 4.
    rm "$file"

    echo "Converted $file to ${file%.md}/index.html"
done

rm style.css