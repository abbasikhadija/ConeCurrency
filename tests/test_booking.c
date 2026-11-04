#include "booking.h"
#include "stats.h"

#include <assert.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>

#define NUM_THREADS 100
#define INITIAL_TICKETS 50

static void test_sequential_depletion(void)
{
    booking_init(3);
    assert(booking_remaining() == 3);

    assert(booking_try_reserve() == BOOK_OK);
    assert(booking_remaining() == 2);

    assert(booking_try_reserve() == BOOK_OK);
    assert(booking_remaining() == 1);

    assert(booking_try_reserve() == BOOK_OK);
    assert(booking_remaining() == 0);

    /* 4th booking must fail */
    assert(booking_try_reserve() == BOOK_SOLD_OUT);
    assert(booking_remaining() == 0);

    printf("PASS: test_sequential_depletion (3 tickets, 4 attempts = 3 OK, 1 SOLD_OUT)\n");
}

static void test_zero_inventory(void)
{
    booking_init(0);
    assert(booking_remaining() == 0);
    assert(booking_try_reserve() == BOOK_SOLD_OUT);
    assert(booking_remaining() == 0);

    printf("PASS: test_zero_inventory\n");
}

struct worker_arg {
    int id;
    enum booking_result result;
};

static void *worker_thread(void *arg)
{
    struct worker_arg *data = (struct worker_arg *)arg;
    data->result = booking_try_reserve();
    if (data->result == BOOK_OK) {
        stats_inc(STAT_BOOKED);
    } else {
        stats_inc(STAT_SOLD_OUT);
    }
    return NULL;
}

static void test_concurrent_depletion(void)
{
    pthread_t threads[NUM_THREADS];
    struct worker_arg args[NUM_THREADS];

    booking_init(INITIAL_TICKETS);
    assert(booking_remaining() == INITIAL_TICKETS);

    for (int i = 0; i < NUM_THREADS; ++i) {
        args[i].id = i;
        int rc = pthread_create(&threads[i], NULL, worker_thread, &args[i]);
        assert(rc == 0);
    }

    int ok_count = 0;
    int sold_out_count = 0;

    for (int i = 0; i < NUM_THREADS; ++i) {
        pthread_join(threads[i], NULL);
        if (args[i].result == BOOK_OK) {
            ok_count++;
        } else if (args[i].result == BOOK_SOLD_OUT) {
            sold_out_count++;
        }
    }

    assert(ok_count == INITIAL_TICKETS);
    assert(sold_out_count == (NUM_THREADS - INITIAL_TICKETS));
    assert(booking_remaining() == 0);

    printf("PASS: test_concurrent_depletion (%d threads for %d tickets = exactly %d OK, %d SOLD_OUT)\n",
           NUM_THREADS, INITIAL_TICKETS, ok_count, sold_out_count);
}

int main(void)
{
    printf("Running P1 booking and synchronization unit tests...\n");
    test_sequential_depletion();
    test_zero_inventory();
    test_concurrent_depletion();
    printf("All P1 unit tests passed successfully!\n");
    return 0;
}

