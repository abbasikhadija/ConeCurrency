CC = gcc
CPPFLAGS += -D_POSIX_C_SOURCE=200809L -Iinclude
CFLAGS ?= -std=c11 -Wall -Wextra -Werror -O2 -g
LDLIBS += -pthread
PYTHON ?= python3
P2_SOURCES = src/main.c src/options.c src/network.c src/handler.c src/sequential.c
P1_SOURCES = src/booking.c src/stats.c
P3_SOURCES = src/queue.c src/threadpool.c src/concurrent.c
HEADERS = $(wildcard include/*.h)

.PHONY: all clean test run-sequential concurrent
all: ticket-server

# Production builds intentionally require the real P1 modules.
ticket-server: $(P2_SOURCES) $(P1_SOURCES) $(HEADERS)
	$(CC) $(CPPFLAGS) $(CFLAGS) $(P2_SOURCES) $(P1_SOURCES) -o $@ $(LDLIBS)

concurrent: $(P2_SOURCES) $(P1_SOURCES) $(P3_SOURCES) $(HEADERS)
	$(CC) $(CPPFLAGS) -DWITH_CONCURRENT $(CFLAGS) $(P2_SOURCES) $(P1_SOURCES) $(P3_SOURCES) -o ticket-server $(LDLIBS)

build/p2-test-server: $(P2_SOURCES) tests/p1_stub.c $(HEADERS)
	mkdir -p build
	$(CC) $(CPPFLAGS) $(CFLAGS) $(P2_SOURCES) tests/p1_stub.c -o $@ $(LDLIBS)

build/test-handler: src/handler.c tests/test_handler.c tests/p1_stub.c $(HEADERS)
	mkdir -p build
	$(CC) $(CPPFLAGS) $(CFLAGS) src/handler.c tests/test_handler.c tests/p1_stub.c -o $@ $(LDLIBS)

test: build/p2-test-server build/test-handler
	./build/test-handler
	$(PYTHON) -m unittest discover -s tests -p 'test_*.py' -v

run-sequential: ticket-server
	./ticket-server --mode sequential --tickets 10 --port 8080 --delay-ms 20

clean:
	rm -rf build ticket-server
