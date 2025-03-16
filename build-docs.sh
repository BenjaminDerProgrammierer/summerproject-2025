# Build docs for the project
# Usage: ./build-docs.sh

# Create the docs directory if it doesn't exist
mkdir -p docs

# for each markdown file in the docs directory
# 1. Create a directory with the same name as the markdown file
# 2. Copy any referenced images to the output directory
# 3. Convert the markdown file to html
# 4. Remove the original markdown file
for file in docs/*.md; do
    # 1.
    mkdir -p "${file%.md}"
    
    # 2.
    grep -o '!\[.*\]([^)]*\.png)' "$file" | sed 's/.*(\(.*\))/\1/' | while read img; do
        if [ -f "docs/$img" ]; then
            mv "docs/$img" "${file%.md}/"
            echo "Copied $img to ${file%.md}/"
        fi
    done
    
    # 3.
    pandoc -s "$file" --from markdown --to html5 --standalone \
        --embed-resources --mathjax --css=./docs/style.css \
        -o "${file%.md}/index.html"
    
    # 4.
    rm "$file"

    echo "Converted $file to ${file%.md}/index.html"
done
