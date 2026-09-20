import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLIntegrityConstraintViolationException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ApiServer {

    private static final String ALLOWED_ORIGIN = "http://localhost:3000";

    public static void main(String[] args) throws Exception {

        HttpServer server = HttpServer.create(
                new InetSocketAddress(8080),
                0
        );

        // =====================================================
        // UPCOMING ASSIGNMENTS API
        // =====================================================

        server.createContext(
                "/api/upcoming",
                ApiServer::getUpcomingAssignments
        );


        // =====================================================
        // ALL ASSIGNMENTS API
        // =====================================================

        server.createContext(
                "/api/assignments",
                ApiServer::getAllAssignments
        );


        // =====================================================
        // ADD ASSIGNMENT API
        // =====================================================

        server.createContext(
                "/api/add",
                ApiServer::addAssignment
        );


        server.start();

        System.out.println("API Server started!");
        System.out.println("http://localhost:8080");
    }


    // =========================================================
    // HELPER: SEND A JSON RESPONSE (status code + CORS header)
    // =========================================================

    private static void sendJson(
            HttpExchange exchange,
            int statusCode,
            String json
    ) throws IOException {

        exchange.getResponseHeaders().set(
                "Content-Type",
                "application/json; charset=UTF-8"
        );

        exchange.getResponseHeaders().set(
                "Access-Control-Allow-Origin",
                ALLOWED_ORIGIN
        );

        byte[] response = json.getBytes(StandardCharsets.UTF_8);

        exchange.sendResponseHeaders(
                statusCode,
                response.length
        );

        try (
                OutputStream output =
                        exchange.getResponseBody()
        ) {

            output.write(response);
        }
    }


    // =========================================================
    // HELPER: ANSWER THE BROWSER'S CORS "PREFLIGHT" REQUEST
    // Browsers send an OPTIONS request before a POST with a
    // JSON body. If it is not answered with 204 + these headers,
    // the browser blocks the real POST.
    // Returns true if the request was a preflight (already handled)
    // =========================================================

    private static boolean handlePreflight(
            HttpExchange exchange
    ) throws IOException {

        if (!exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
            return false;
        }

        exchange.getResponseHeaders().set(
                "Access-Control-Allow-Origin",
                ALLOWED_ORIGIN
        );

        exchange.getResponseHeaders().set(
                "Access-Control-Allow-Methods",
                "GET, POST, OPTIONS"
        );

        exchange.getResponseHeaders().set(
                "Access-Control-Allow-Headers",
                "Content-Type"
        );

        exchange.sendResponseHeaders(204, -1);
        exchange.close();

        return true;
    }


    // =========================================================
    // HELPER: ESCAPE TEXT SO IT IS SAFE INSIDE A JSON STRING
    // (a title like: Read "Chapter 1" would break the JSON otherwise)
    // =========================================================

    private static String escapeJson(String value) {

        if (value == null) {
            return "";
        }

        StringBuilder out = new StringBuilder();

        for (char c : value.toCharArray()) {

            switch (c) {
                case '"':
                    out.append("\\\"");
                    break;
                case '\\':
                    out.append("\\\\");
                    break;
                case '\n':
                    out.append("\\n");
                    break;
                case '\r':
                    out.append("\\r");
                    break;
                case '\t':
                    out.append("\\t");
                    break;
                default:
                    if (c < 0x20) {
                        out.append(String.format("\\u%04x", (int) c));
                    } else {
                        out.append(c);
                    }
            }
        }

        return out.toString();
    }


    // =========================================================
    // HELPER: READ VALUES OUT OF THE REQUEST JSON
    // (handles quotes and spaces inside values, no library needed)
    // =========================================================

    private static String getJsonString(String body, String key) {

        Matcher matcher = Pattern
                .compile("\"" + key + "\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"")
                .matcher(body);

        if (!matcher.find()) {
            return null;
        }

        return unescapeJson(matcher.group(1));
    }

    private static String getJsonNumber(String body, String key) {

        Matcher matcher = Pattern
                .compile("\"" + key + "\"\\s*:\\s*(-?\\d+)")
                .matcher(body);

        return matcher.find() ? matcher.group(1) : null;
    }

    private static String unescapeJson(String value) {

        StringBuilder out = new StringBuilder();

        for (int i = 0; i < value.length(); i++) {

            char c = value.charAt(i);

            if (c == '\\' && i + 1 < value.length()) {

                char next = value.charAt(++i);

                switch (next) {
                    case 'n':
                        out.append('\n');
                        break;
                    case 'r':
                        out.append('\r');
                        break;
                    case 't':
                        out.append('\t');
                        break;
                    case 'u':
                        out.append((char) Integer.parseInt(
                                value.substring(i + 1, i + 5), 16));
                        i += 4;
                        break;
                    default:
                        out.append(next);
                }

            } else {

                out.append(c);
            }
        }

        return out.toString();
    }


    // =========================================================
    // GET UPCOMING ASSIGNMENTS
    // =========================================================

    private static void getUpcomingAssignments(
            HttpExchange exchange
    ) throws IOException {

        if (handlePreflight(exchange)) {
            return;
        }

        StringBuilder json = new StringBuilder();

        json.append("[");

        String sql =
                "SELECT * FROM assignments " +
                "WHERE status = 'Pending' " +
                "AND deadline BETWEEN CURDATE() " +
                "AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) " +
                "ORDER BY deadline";

        try (
                Connection connection =
                        DatabaseManager.getConnection();

                PreparedStatement statement =
                        connection.prepareStatement(sql);

                ResultSet result =
                        statement.executeQuery()
        ) {

            boolean first = true;

            while (result.next()) {

                if (!first) {
                    json.append(",");
                }

                java.sql.Date deadline = result.getDate("deadline");

                json.append("{");

                json.append("\"id\":")
                        .append(result.getInt("id"))
                        .append(",");

                json.append("\"title\":\"")
                        .append(escapeJson(result.getString("title")))
                        .append("\",");

                json.append("\"subject\":\"")
                        .append(escapeJson(result.getString("subject")))
                        .append("\",");

                json.append("\"deadline\":\"")
                        .append(deadline == null ? "" : deadline.toString())
                        .append("\"");

                json.append("}");

                first = false;
            }

        } catch (Exception e) {

            e.printStackTrace();

            sendJson(
                    exchange,
                    500,
                    "{\"error\":\"Database error\"}"
            );

            return;
        }

        json.append("]");

        sendJson(exchange, 200, json.toString());
    }


    // =========================================================
    // GET ALL ASSIGNMENTS
    // =========================================================

    private static void getAllAssignments(
            HttpExchange exchange
    ) throws IOException {

        if (handlePreflight(exchange)) {
            return;
        }

        StringBuilder json = new StringBuilder();

        json.append("[");

        String sql =
                "SELECT * FROM assignments " +
                "ORDER BY deadline";

        try (
                Connection connection =
                        DatabaseManager.getConnection();

                PreparedStatement statement =
                        connection.prepareStatement(sql);

                ResultSet result =
                        statement.executeQuery()
        ) {

            boolean first = true;

            while (result.next()) {

                if (!first) {
                    json.append(",");
                }

                java.sql.Date deadline = result.getDate("deadline");

                json.append("{");

                json.append("\"id\":")
                        .append(result.getInt("id"))
                        .append(",");

                json.append("\"title\":\"")
                        .append(escapeJson(result.getString("title")))
                        .append("\",");

                json.append("\"subject\":\"")
                        .append(escapeJson(result.getString("subject")))
                        .append("\",");

                json.append("\"deadline\":\"")
                        .append(deadline == null ? "" : deadline.toString())
                        .append("\",");

                json.append("\"status\":\"")
                        .append(escapeJson(result.getString("status")))
                        .append("\"");

                json.append("}");

                first = false;
            }

        } catch (Exception e) {

            e.printStackTrace();

            sendJson(
                    exchange,
                    500,
                    "{\"error\":\"Database error\"}"
            );

            return;
        }

        json.append("]");

        sendJson(exchange, 200, json.toString());
    }


    // =========================================================
    // POST ADD ASSIGNMENT
    // =========================================================

    private static void addAssignment(
            HttpExchange exchange
    ) throws IOException {

        // Browser preflight (OPTIONS) must be answered before the POST
        if (handlePreflight(exchange)) {
            return;
        }

        if (!exchange.getRequestMethod().equalsIgnoreCase("POST")) {

            exchange.sendResponseHeaders(405, -1);
            exchange.close();
            return;
        }


        // =====================================================
        // READ JSON DATA
        // =====================================================

        String body = new String(
                exchange.getRequestBody().readAllBytes(),
                StandardCharsets.UTF_8
        );

        System.out.println("Received data:");
        System.out.println(body);


        // =====================================================
        // EXTRACT + VALIDATE DATA FROM JSON
        // =====================================================

        int id;
        String title;
        String subject;
        String status;
        java.sql.Date deadline;

        try {

            String idText = getJsonNumber(body, "id");

            title = getJsonString(body, "title");
            subject = getJsonString(body, "subject");
            status = getJsonString(body, "status");

            String deadlineText = getJsonString(body, "deadline");

            if (idText == null
                    || title == null || title.trim().isEmpty()
                    || subject == null || subject.trim().isEmpty()
                    || status == null
                    || deadlineText == null) {

                throw new IllegalArgumentException("Missing field");
            }

            id = Integer.parseInt(idText);

            // Must be yyyy-mm-dd
            deadline = java.sql.Date.valueOf(deadlineText);

        } catch (Exception e) {

            sendJson(
                    exchange,
                    400,
                    "{\"error\":\"Invalid or missing fields\"}"
            );

            return;
        }


        // =====================================================
        // INSERT INTO MYSQL
        // =====================================================

        String sql =
                "INSERT INTO assignments " +
                "(id, title, subject, deadline, status) " +
                "VALUES (?, ?, ?, ?, ?)";


        try (
                Connection connection =
                        DatabaseManager.getConnection();

                PreparedStatement statement =
                        connection.prepareStatement(sql)
        ) {

            statement.setInt(1, id);
            statement.setString(2, title);
            statement.setString(3, subject);
            statement.setDate(4, deadline);
            statement.setString(5, status);

            statement.executeUpdate();

            System.out.println(
                    "Assignment inserted into MySQL!"
            );

        } catch (SQLIntegrityConstraintViolationException e) {

            // Duplicate primary key: the ID is already used
            sendJson(
                    exchange,
                    409,
                    "{\"error\":\"ID " + id + " already exists\"}"
            );

            return;

        } catch (Exception e) {

            e.printStackTrace();

            sendJson(
                    exchange,
                    500,
                    "{\"error\":\"Database error\"}"
            );

            return;
        }


        // =====================================================
        // SEND RESPONSE (only reached if the insert worked)
        // =====================================================

        sendJson(
                exchange,
                200,
                "{\"message\":\"Assignment added successfully\"}"
        );
    }
}