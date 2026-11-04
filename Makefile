CC = gcc
CPPFLAGS += -D_POSIX_C_SOURCE=200809L -Iinclude
CFLAGS ?= -std=c11 -Wall -Wextra -Werror -O2 -g
LDLIBS += -pthread
PYTHON ?= python3
P2_SOURCES = src/main.c src/options.c src/network.c src/handler.c src/sequential.c
P1_SOURCES = src/booking.c src/stats.c
P3_SOURCES = src/queue.c src/threadpool.c src/concurrent.c
HEADERS = $(wildcard include/*.h)

.PHONY: all clean test test-p1 test-p2 test-p3 test-race test-all run-sequential run-concurrent concurrent unsafe

all: ticket-server

# One production binary supports both modes with the real P1 and P3 modules.
ticket-server: $(P2_SOURCES) $(P1_SOURCES) $(P3_SOURCES) $(HEADERS)
	$(CC) $(CPPFLAGS) -DWITH_CONCURRENT $(CFLAGS) $(P2_SOURCES) $(P1_SOURCES) $(P3_SOURCES) -o $@ $(LDLIBS)

# Production concurrent build
concurrent: ticket-server

# Unsafe build for Lab 11 race condition demonstration (no mutex)
unsafe: build/ticket-server-unsafe

build/ticket-server-unsafe: $(P2_SOURCES) $(P1_SOURCES) $(P3_SOURCES) $(HEADERS)
	mkdir -p build
	$(CC) $(CPPFLAGS) -DWITH_CONCURRENT -DUNSAFE_MODE $(CFLAGS) $(P2_SOURCES) $(P1_SOURCES) $(P3_SOURCES) -o $@ $(LDLIBS)

# P1 booking unit test target
build/test-booking: tests/test_booking.c $(P1_SOURCES) $(HEADERS)
	mkdir -p build
	$(CC) $(CPPFLAGS) $(CFLAGS) tests/test_booking.c $(P1_SOURCES) -o $@ $(LDLIBS)

# P2 test targets
build/p2-test-server: $(P2_SOURCES) tests/p1_stub.c $(HEADERS)
	mkdir -p build
	$(CC) $(CPPFLAGS) $(CFLAGS) $(P2_SOURCES) tests/p1_stub.c -o $@ $(LDLIBS)

build/test-handler: src/handler.c tests/test_handler.c tests/p1_stub.c $(HEADERS)
	mkdir -p build
	$(CC) $(CPPFLAGS) $(CFLAGS) src/handler.c tests/test_handler.c tests/p1_stub.c -o $@ $(LDLIBS)

test-p2: build/p2-test-server build/test-handler
	./build/test-handler
	$(PYTHON) -m unittest discover -s tests -p 'test_network.py' -v

build/test-queue: src/queue.c tests/test_queue.c $(HEADERS)
	mkdir -p build
	$(CC) $(CPPFLAGS) $(CFLAGS) src/queue.c tests/test_queue.c -o $@ $(LDLIBS)

build/test-threadpool: src/queue.c src/threadpool.c tests/test_threadpool.c $(HEADERS)
	mkdir -p build
	$(CC) $(CPPFLAGS) $(CFLAGS) src/queue.c src/threadpool.c tests/test_threadpool.c -o $@ $(LDLIBS)

test-p3: ticket-server build/test-queue build/test-threadpool
	./build/test-queue
	./build/test-threadpool
	P3_TEST_SERVER=./ticket-server $(PYTHON) -m unittest discover -s tests -p 'test_concurrent.py' -v

# Person 1 specific test suite
test-p1: build/test-booking ticket-server
	./build/test-booking

test-race: ticket-server
	$(PYTHON) tests/test_race.py

# Full combined test suite
test test-all: test-p1 test-p2 test-p3 test-race
	P2_TEST_SERVER=./ticket-server $(PYTHON) -m unittest discover -s tests -p 'test_network.py' -v
	$(PYTHON) -m unittest discover -s tests -p 'test_integration.py' -v

run-sequential: ticket-server
	./ticket-server --mode sequential --tickets 10 --port 8080 --delay-ms 20

run-concurrent: ticket-server
	./ticket-server --mode concurrent --tickets 10 --workers 4 --queue 32 --port 8080 --delay-ms 20

clean:
	rm -rf build ticket-server
