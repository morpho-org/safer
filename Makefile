-include .env
.EXPORT_ALL_VARIABLES:
MAKEFLAGS += --no-print-directory

NETWORK ?= ethereum-mainnet


install: clean
	foundryup
	forge install

tx:
	npx create-safe-tx
	mv tx.json data/tx.json

hash:
	forge script script/HashData.s.sol

sign\:%: hash
	cast wallet sign --$* $$(cat data/hashData.txt) 1>> data/signatures.txt
	@echo "\033[0;32mTx signature successfully appended to data/signatures.txt"

simulate\:%:
	forge script script/ExecTransaction.s.sol --$*

exec\:%:
	forge script script/ExecTransaction.s.sol --$* --broadcast

clean:
	mkdir -p data
	cp data/template.json data/tx.json
	> data/hashData.txt
	> data/signatures.txt


.PHONY: contracts test coverage hash sign simulate exec clean
