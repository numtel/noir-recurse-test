# Noir Recursion example

Minimal Noir recursion example

```
$ git clone https://github.com/numtel/noir-recurse-test/
$ cd noir-recurse-test
$ npm install

# Must generate vk from cli
$ cd src/inner
$ nargo compile
$ bb write_vk -v -s ultra_honk -b "./target/inner.json" -o ./target --output_format bytes_and_fields --honk_recursion 1 --init_kzg_accumulator
$ cd ../..

# Run the frontend
$ npm start
```


