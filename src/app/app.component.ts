import {Component, OnInit, QueryList, ViewChildren} from "@angular/core";
import {TimetableComponent} from "./components/timetable/timetable.component";
import {parseCourse, UofT} from "./models/course";
import {CourseService} from "./services/course.service";
import {
    Constraint,
    CourseSolution,
    ExhaustiveSolver,
    StepHeuristicSolver,
    TimeConflictConstraint
} from "./course-arrange";
import {Term} from "./models/term";
import {environment} from "../environments/environment";
import {LogLevelDesc} from "loglevel";
import log = require("loglevel");
import _ = require("lodash");
import Collections = require("typescript-collections");


@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
    /**
     * A set of selected courses string in course bar
     * @type {string[]}
     */
    selectedCourses: string[];

    /**
     * Controlling term panel
     * and other term related functionality
     */
    terms: Term[];
    activeTerm: Term;

    /**
     * Search-bar loading spin
     * @type {boolean}
     */
    loading: boolean = false;

    // Two timetable one for Fall one for Winter
    @ViewChildren(TimetableComponent) timetables: QueryList<TimetableComponent>;

    /**
     * Current constraint list
     * Used by constraint.component
     */
    constraints: Constraint[];

    solutionTable: Collections.Dictionary<Term, CourseSolution[]>;

    /**
     * Currently displayed solution list on the scroll bar
     */
    solutions: CourseSolution[];

    constructor(private courseService: CourseService,) {
        this.terms = Term.getTerms();
        this.activeTerm = this.terms[0];
        this.selectedCourses = this.courseService.loadCourseList();
        this.constraints = [
            new TimeConflictConstraint()
        ];
        this.solutionTable = new Collections.Dictionary<Term, CourseSolution[]>();
        this.terms.forEach(t => this.solutionTable.setValue(t, []));
    }


    ngOnInit(): void {
        log.setLevel(<LogLevelDesc>environment.logLevel);
    }

    /**
     * Evaluate solution with given course list
     */
    private eval(courses: UofT.Course[]): CourseSolution[] {
        const parsedCourses = courses.map(parseCourse);
        // Try Exhaustive Solver first
        const exSolver = new ExhaustiveSolver(parsedCourses);
        try {
            return exSolver.solve(this.constraints);
        } catch (e) {
            log.info("ExhaustiveSolver failed");
            log.info(e);
            log.info("try heuristic solver");
            // If input too large, then use heuristic solver
            const heSolver = new StepHeuristicSolver(parsedCourses);
            return heSolver.solve(this.constraints);
        }
    }

    renderSolution(solution: CourseSolution) {
        this.timetables
            .filter(tt => tt.term.equals(this.activeTerm))
            .forEach(tt => tt.timetable.parseSolution(solution));
    }

    getSolutions() {
        Promise.all(this.activeCourses().map(this.courseService.fetchCourseBody))
            .then(courses => {
                const solutions = this.eval(_.flatten(courses));
                this.solutionTable.setValue(this.activeTerm, solutions);
                if (solutions.length > 0) {
                    this.renderSolution(solutions[0]);
                }
            });
    }

    activeCourses() {
        return this.selectedCourses.filter(c => {
            return this.courseTerm(c).includes(this.activeTerm);
        });
    }

    selectTerm(term: Term) {
        this.activeTerm = term;
    }

    /**
     * Extract term information from course code
     * @param code full course code
     * @return {Term[]} which term the course belongs to
     */
    private courseTerm(code): Term[] {
        if (code.indexOf("H1F") > -1) return [this.terms[0]];
        if (code.indexOf("H1S") > -1) return [this.terms[1]];
        if (code.indexOf("Y1Y") > -1) return this.terms;
        else {
            log.warn("Unrecognizable course term for course " + code);
            return [];
        }
    }

    deleteCourse(course: string): void {
        const courses = this.selectedCourses;
        courses.splice(courses.indexOf(course), 1);
        this.courseService.storeCourseList(this.selectedCourses);
    }

    addCourse(course: UofT.Course): void {
        this.selectedCourses.push(course.code);
        this.courseService.storeCourseList(this.selectedCourses);
    }
}
