CC = gcc
CPPFLAGS += -D_POSIX_C_SOURCE=200809L -Iinclude
CFLAGS ?= -std=c11 -Wall -Wextra -Werror -O2 -g
LDLIBS += -pthread
PYTHON ?= python3
P2_SOURCES = src/main.c src/options.c src/network.c src/handler.c src/sequential.c
P1_SOURCES = src/booking.c src/stats.c
P3_SOURCES = src/queue.c src/threadpool.c src/concurrent.c
HEADERS = $(wildcard include/*.h)

.PHONY: all clean test test-p1 test-race test-all run-sequential concurrent unsafe

all: ticket-server

# Production sequential build
ticket-server: $(P2_SOURCES) $(P1_SOURCES) $(HEADERS)
	$(CC) $(CPPFLAGS) $(CFLAGS) $(P2_SOURCES) $(P1_SOURCES) -o $@ $(LDLIBS)

# Production concurrent build
concurrent: $(P2_SOURCES) $(P1_SOURCES) $(P3_SOURCES) $(HEADERS)
	$(CC) $(CPPFLAGS) -DWITH_CONCURRENT $(CFLAGS) $(P2_SOURCES) $(P1_SOURCES) $(P3_SOURCES) -o ticket-server $(LDLIBS)

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

test: build/p2-test-server build/test-handler
	./build/test-handler
	$(PYTHON) -m unittest discover -s tests -p 'test_*.py' -v

# Person 1 specific test suite
test-p1: build/test-booking concurrent
	./build/test-booking
	$(PYTHON) tests/test_race.py

# Full combined test suite
test-all: test-p1 test

run-sequential: ticket-server
	./ticket-server --mode sequential --tickets 10 --port 8080 --delay-ms 20

clean:
	rm -rf build ticket-server
