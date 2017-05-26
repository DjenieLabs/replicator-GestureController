var gulp = require('gulp'),
    gutil = require('gulp-util'),
    jshint = require('gulp-jshint');

// Check the code quality
gulp.task('qualitychecker', function(cb) {
    return gulp.src([
      '**/*.js',
      '!node_modules/**/*.js'])
    .pipe(jshint({esversion: 6}))
    .pipe(jshint.reporter('default'))
    .on('error', gutil.log);
});

gulp.task('default', ['qualitychecker']);
