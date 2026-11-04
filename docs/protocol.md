# ConeCurrency shared protocol

The Team Task Division supplies the BOOK protocol. The ice cream interface maps
one booking to one signature cone from a single shared inventory. Flavors,
quantities, payments, and stock queries are not part of this protocol.

## Request and responses

One TCP connection carries one request and one response. The server listens on
IPv4 loopback, 127.0.0.1 (default port 8080). Send exactly `BOOK\n` (five ASCII
bytes, including LF). Replies are:

| Reply | Meaning |
| --- | --- |
| `OK BOOKED\n` | One inventory unit reserved |
| `ERR SOLD_OUT\n` | No units available |
| `ERR BAD_REQUEST\n` | Invalid, incomplete, timed out, or oversized request |
| `ERR BUSY\n` | P3 queue rejected the connection |

The P2 implementation reads through the first LF, handles fragmented TCP data,
and inspects at most MAX_REQ=64 bytes. It rejects CRLF, embedded NUL, extra spaces,
lowercase commands, and a request that has no LF within that limit. Bytes after
the first LF are not processed. There is no second request on a connection.

Receive time is limited to two seconds total, including slowly trickled bytes.
Replies also have a bounded send timeout. Disconnects and failed writes do not
terminate the process. A booked order is not rolled back on a lost response;
there are no request IDs or automatic safe retries. Clients should avoid automatic
retries after an ambiguous response loss.

## Ownership

`handle_client(int fd)` never closes its descriptor. The sequential accept loop
closes it after the handler returns. In concurrent mode the worker closes it.
When queue_try_push returns false, the acceptor retains ownership, sends
ERR BUSY with a bounded write, increments STAT_BUSY, and closes it.

The handler performs artificial work before booking, outside every lock.
Booking and statistics calls are separate; never hold two locks together.
Initialize inventory and handler configuration before starting workers.

## Agreement status

BOOK/replies/flags/descriptor ownership come from the supplied task division.
The merged components use the shared C signatures, limits and strict LF behavior
documented here. Integration preserves those interfaces and response bytes.
Formal team signoff is separate from build and runtime verification.
