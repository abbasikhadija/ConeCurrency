#include "booking.h"
#include "server.h"

#include <assert.h>
#include <fcntl.h>
#include <signal.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

volatile sig_atomic_t server_stop;

int main(void)
{
    int pair[2];
    char response[64];
    signal(SIGPIPE, SIG_IGN);
    booking_init(1);
    handler_configure(0);
    assert(socketpair(AF_UNIX, SOCK_STREAM, 0, pair) == 0);
    assert(write(pair[0], "BOOK\n", 5) == 5);
    handle_client(pair[1]);
    /* Handler must return ownership to caller with descriptor still open. */
    assert(fcntl(pair[1], F_GETFD) != -1);
    ssize_t received = read(pair[0], response, sizeof response);
    assert(received == 10 && memcmp(response, "OK BOOKED\n", 10) == 0);
    assert(booking_remaining() == 0);
    close(pair[0]);
    close(pair[1]);
    return 0;
}
