from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from .models import Movie
from .forms import MovieForm

# List all movies
@login_required
def movie_list(request):
    # Show all movies, this view only serves the template - data comes from API
    # Provide current user info so the frontend can filter movies client-side
    return render(request, 'movies/movie_list.html', {
        'current_user_id': request.user.id,
        'current_username': request.user.username,
    })

# Create a new movie
def movie_create(request):
    # This view only serves the form template - submission is handled by JS
    form = MovieForm()
    return render(request, 'movies/movie_form.html', {'form': form})

# Update an existing movie
@login_required
def movie_update(request, pk):
    # This view only serves the form template with data - submission is handled by JS
    try:
        movie = get_object_or_404(Movie, pk=pk)
        form = MovieForm(instance=movie)
    except Movie.DoesNotExist:
        # If the movie doesn't exist locally, still show the form for API editing
        form = MovieForm()
    
    return render(request, 'movies/movie_form.html', {'form': form})

# Delete a movie
@login_required
def movie_delete(request, pk):
    # This view only serves the confirmation template - deletion is handled by JS
    try:
        movie = get_object_or_404(Movie, pk=pk)
    except Movie.DoesNotExist:
        # If the movie doesn't exist locally, use a dummy object for the template
        from django.contrib.auth.models import AnonymousUser
        movie = Movie(id=pk, title="Movie", created_by=AnonymousUser())
    
    return render(request, 'movies/movie_confirm_delete.html', {'object': movie})

# Create your views here.
