public class Assignment {

    private int id;
    private String title;
    private String subject;
    private String deadline;
    private String status;

    // Constructor
    public Assignment(int id, String title, String subject, String deadline, String status) {
        this.id = id;
        this.title = title;
        this.subject = subject;
        this.deadline = deadline;
        this.status = status;
    }

    // Getter and Setter for ID
    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    // Getter and Setter for Title
    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    // Getter and Setter for Subject
    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    // Getter and Setter for Deadline
    public String getDeadline() {
        return deadline;
    }

    public void setDeadline(String deadline) {
        this.deadline = deadline;
    }

    // Getter and Setter for Status
    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    // Display Assignment
    public void display() {
        System.out.println("ID = " + id);
        System.out.println("Title = " + title);
        System.out.println("Subject = " + subject);
        System.out.println("Deadline = " + deadline);
        System.out.println("Status = " + status);
    }
}